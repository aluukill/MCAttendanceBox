import { useState, useRef, useEffect, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, addDoc, getDocs, query, where, getDocsFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Loader2, Camera, CheckCircle2, AlertCircle, ScanFace, User, X, RotateCcw, Search, UserPlus } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export default function Register() {
  const { user } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<'ready' | 'scanning' | 'success' | 'error'>('ready');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [webcamError, setWebcamError] = useState<string | null>(null);

   const webcamRef = useRef<Webcam>(null);
   const scanIntervalRef = useRef<number | null>(null);
   const isProcessingRef = useRef<boolean>(false);
   const registrationAttemptRef = useRef<number>(0);

  const handleOpenCamera = () => {
    if (!name.trim() || !studentId.trim()) {
      setStatus({ type: 'error', message: 'Please fill out all fields.' });
      return;
    }
    // Reset attempt counter for this registration session
    registrationAttemptRef.current = 0;
    setScanStatus('ready');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isProcessingRef.current = false;
    setIsDialogOpen(false);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (!isDialogOpen) return;

    let active = true;

    const startScanning = async () => {
      try {
        await loadFaceApiModels();
        if (!active) return;

        setScanStatus('scanning');

        scanIntervalRef.current = window.setInterval(async () => {
          if (!webcamRef.current || !webcamRef.current.video || !active) return;

          const videoEl = webcamRef.current.video;
          if (videoEl.readyState !== 4) return;

          // Prevent race condition: if already processing a face, skip this tick
          if (isProcessingRef.current) return;

          try {
            const detections = await faceapi
              .detectAllFaces(
                videoEl,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 })
              )
              .withFaceLandmarks()
              .withFaceDescriptors();

            if (detections.length === 0) return;

            if (detections.length > 1) {
              setScanStatus('error');
              return;
            }

            // Clear interval immediately to prevent any further ticks from starting
            // This must happen BEFORE we mark as processing, to close the race window
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
            }

            // Second guard: if another tick already started processing, abort
            if (isProcessingRef.current) {
              return;
            }

            // Increment attempt counter to identify this registration attempt
            registrationAttemptRef.current += 1;
            const currentAttempt = registrationAttemptRef.current;

            // Mark as processing to prevent duplicate detections within this attempt
            isProcessingRef.current = true;

            const newDescriptor = detections[0].descriptor;

            // Fetch all existing students for this teacher to check for duplicate face
            // Use 'server' source to bypass local cache and get fresh data
            const q = query(
              collection(db, 'students'),
              where('teacherUid', '==', user?.uid)
            );
            const existingSnap = await getDocsFromServer(q);

            console.log('=== REGISTRATION DEBUG ===');
            console.log('Current user UID:', user?.uid);
            console.log('Total students fetched for this teacher:', existingSnap.size);
            console.log('Registration attempt:', currentAttempt);

            // Check for face similarity AND duplicate studentId/name in a SINGLE loop
            const FACE_MATCH_THRESHOLD = 0.6;
            let bestMatch: { name: string; distance: number } | null = null;
            let isDuplicate = false;

            existingSnap.forEach(doc => {
              const data = doc.data();
              // Check face similarity
              if (data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128) {
                const existingDescriptor = new Float32Array(data.faceDescriptor);
                const distance = faceapi.euclideanDistance(newDescriptor, existingDescriptor);
                console.log(`  Distance to "${data.name}": ${distance.toFixed(4)}`);
                // Keep track of the closest match
                if (!bestMatch || distance < bestMatch.distance) {
                  bestMatch = { name: data.name, distance };
                }
              }
              // Check duplicate studentId or name (both normalized to lowercase)
              if ((data.studentId && studentId && data.studentId.toLowerCase() === studentId.toLowerCase()) ||
                  (typeof data.name === 'string' && data.name.trim() && name.trim() && data.name.toLowerCase() === name.toLowerCase())) {
                isDuplicate = true;
              }
            });

            // Only block if the best (closest) match is below threshold
            if (bestMatch && bestMatch.distance < FACE_MATCH_THRESHOLD) {
              console.log(`[Attempt ${currentAttempt}] Face matched existing student: "${bestMatch.name}" with distance ${bestMatch.distance.toFixed(4)}`);
              isProcessingRef.current = false;
              setScanStatus('error');
              setStatus({
                type: 'error',
                message: `This face is already registered as '${bestMatch.name}'.`
              });
              setTimeout(() => {
                // Only close if this is still the latest attempt
                if (registrationAttemptRef.current === currentAttempt) {
                  handleCloseDialog();
                }
              }, 3000);
              return;
            }

            if (isDuplicate) {
              console.log(`[Attempt ${currentAttempt}] Duplicate studentId or name found`);
              isProcessingRef.current = false;
              setScanStatus('error');
              setStatus({ type: 'error', message: 'Student already exists!' });
              setTimeout(() => {
                if (registrationAttemptRef.current === currentAttempt) {
                  handleCloseDialog();
                }
              }, 2000);
              return;
            }

            const descriptor = Array.from(newDescriptor);

            await addDoc(collection(db, 'students'), {
              name,
              studentId,
              faceDescriptor: descriptor,
              teacherUid: user?.uid,
              createdAt: Date.now()
            });

            console.log(`[Attempt ${currentAttempt}] Successfully registered ${name}`);
            isProcessingRef.current = false;
            setScanStatus('success');
            setStatus({ type: 'success', message: `Successfully registered ${name}.` });
            setName('');
            setStudentId('');

            setTimeout(() => {
              if (registrationAttemptRef.current === currentAttempt) {
                handleCloseDialog();
              }
            }, 1500);

          } catch (e) {
            console.error('Scan error:', e);
            isProcessingRef.current = false;
          }
        }, 500);
      } catch (err: any) {
        setScanStatus('error');
        setStatus({ type: 'error', message: 'Failed to load face detection models.' });
      }
    };

    startScanning();

    return () => {
      active = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isDialogOpen, name, studentId, user]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-900/20">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Register Student</h2>
          <p className="text-gray-500 mt-0.5">Enroll a new student with face recognition</p>
        </div>
      </div>

      <div className="flex-1 grid md:grid-cols-[2fr_1fr] gap-4 md:gap-8 min-h-[400px] md:min-h-[500px]">
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-lg shadow-gray-100/50 border border-gray-100/50 flex flex-col relative overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
            <User className="w-12 h-12 mb-4 text-gray-300" />
            <p className="font-medium text-sm">Fill the form to activate camera</p>
            <p className="text-xs text-gray-400 mt-1">Enter name and student ID to continue</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-lg shadow-gray-100/50 border border-gray-100/50 flex flex-col">
          <div className="flex flex-col h-full">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all text-sm"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID / Roll Number</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all text-sm"
                  placeholder="STU-1001"
                />
              </div>

              {status.type !== 'idle' && (
                <div className={`p-4 rounded-xl text-sm flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                  {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {status.message}
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenCamera}
                disabled={isRegistering || !name.trim() || !studentId.trim()}
                className="w-full flex items-center justify-center gap-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl py-3.5 px-6 font-medium transition-all hover:shadow-lg hover:shadow-gray-900/20 hover:-translate-y-0.5 active:translate-y-0 mt-auto"
              >
                <Camera className="w-5 h-5" />
                Open Camera
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog.Root open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 w-full max-w-sm z-50 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-gray-900">Scan Face</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-2 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </Dialog.Close>
            </div>

            <div className="relative aspect-square bg-gray-900 rounded-2xl overflow-hidden mb-4 mx-auto max-w-xs">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                mirrored={true}
                className="w-full h-full object-cover"
                onUserMedia={() => setWebcamError(null)}
                onError={() => setWebcamError('Camera access denied')}
              />
              
              {/* Status Indicator */}
              <div className="absolute top-4 left-4 right-4">
                <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full backdrop-blur-md ${
                  scanStatus === 'scanning' ? 'bg-blue-600/90' : 
                  scanStatus === 'success' ? 'bg-green-600/90' : 
                  scanStatus === 'error' ? 'bg-red-600/90' : 'bg-gray-800/80'
                }`}>
                  {scanStatus === 'scanning' && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {scanStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-white" />}
                  {scanStatus === 'error' && <AlertCircle className="w-4 h-4 text-white" />}
                  {scanStatus === 'ready' && <Search className="w-4 h-4 text-white" />}
                  <span className="text-white text-sm font-medium">
                    {scanStatus === 'ready' && 'Position your face'}
                    {scanStatus === 'scanning' && 'Detecting...'}
                    {scanStatus === 'success' && 'Registered!'}
                    {scanStatus === 'error' && 'Try again'}
                  </span>
                </div>
              </div>

              <button
                onClick={toggleCamera}
                className="absolute bottom-4 right-4 p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
              >
                <RotateCcw className="w-5 h-5 text-white" />
              </button>

              {/* Detection Box */}
              {(scanStatus === 'scanning' || scanStatus === 'ready') && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-40 rounded-2xl border-2 border-white/30" />
                </div>
              )}

              {/* Success Overlay */}
              {scanStatus === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-600/80">
                  <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
                    <CheckCircle2 className="w-14 h-14 text-green-500 mb-2" />
                    <p className="font-semibold text-gray-900">Success!</p>
                  </div>
                </div>
              )}

              {/* Error Overlay */}
              {scanStatus === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
                    <AlertCircle className="w-14 h-14 text-red-500 mb-2" />
                    <p className="font-semibold text-gray-900 mb-1">Scan Failed</p>
                    <p className="text-xs text-gray-500">Make sure only one face is visible</p>
                  </div>
                </div>
              )}

              {/* Webcam Error */}
              {webcamError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                  <Camera className="w-12 h-12 mb-4 text-red-400" />
                  <p className="text-sm mb-4 text-center px-4">{webcamError}</p>
                  <button
                    onClick={() => {
                      setWebcamError(null);
                      setFacingMode(f => f === 'user' ? 'environment' : 'user');
                    }}
                    className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
