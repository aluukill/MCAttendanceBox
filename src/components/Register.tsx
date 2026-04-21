import { useState, useRef, useEffect, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Loader2, Camera, CheckCircle2, AlertCircle, ScanFace, User, X, RotateCcw } from 'lucide-react';
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

  const handleOpenCamera = () => {
    if (!name.trim() || !studentId.trim()) {
      setStatus({ type: 'error', message: 'Please fill out all fields.' });
      return;
    }
    setScanStatus('ready');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
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

            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
            }

            const descriptor = Array.from(detections[0].descriptor);

            await addDoc(collection(db, 'students'), {
              name,
              studentId,
              faceDescriptor: descriptor,
              teacherUid: user?.uid,
              createdAt: Date.now()
            });

            setScanStatus('success');
            setStatus({ type: 'success', message: `Successfully registered ${name}.` });
            setName('');
            setStudentId('');

            setTimeout(() => {
              handleCloseDialog();
            }, 1500);

          } catch (e) {
            console.error('Scan error:', e);
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
      <div className="mb-8">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Register Student</h2>
        <p className="text-gray-500 mt-1">Enroll a new student. Fill the form and click Open Camera to scan.</p>
      </div>

      <div className="flex-1 grid md:grid-cols-[2fr_1fr] gap-4 md:gap-8 min-h-[400px] md:min-h-[500px]">
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
            <User className="w-12 h-12 mb-4 text-gray-300" />
            <p className="font-medium text-sm">Fill the form to activate camera</p>
            <p className="text-xs text-gray-400 mt-1">Enter name and student ID to continue</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col">
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
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl py-3 px-4 md:py-3.5 md:px-6 font-medium transition-colors mt-auto"
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

            <div className="relative aspect-square bg-black rounded-2xl overflow-hidden mb-4 mx-auto max-w-xs">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                mirrored={true}
                className="w-full h-full object-cover"
                onUserMedia={() => setWebcamError(null)}
                onError={(err) => {
                  console.error('Webcam error:', err);
                  setWebcamError('Camera access denied. Please allow camera permissions and try again.');
                }}
              />
              <button
                onClick={toggleCamera}
                className="absolute bottom-4 right-4 p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors"
              >
                <RotateCcw className="w-5 h-5 text-white" />
              </button>
              <div className="absolute inset-0 pointer-events-none border-[1px] border-dashed border-white/30 m-8 rounded-full opacity-50" />
              
              {webcamError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 rounded-2xl">
                  <Camera className="w-12 h-12 mb-4 text-red-400" />
                  <p className="text-center text-sm mb-4">{webcamError}</p>
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
              
              {scanStatus === 'scanning' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span className="text-white text-sm font-medium">Scanning...</span>
                </div>
              )}
              
              {scanStatus === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
                    <p className="font-medium text-gray-900">Registered!</p>
                  </div>
                </div>
              )}

              {scanStatus === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl p-6 flex flex-col items-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                    <p className="font-medium text-gray-900">Scan Failed</p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 text-center">
              {scanStatus === 'ready' && 'Position your face in the frame'}
              {scanStatus === 'scanning' && 'Detecting face...'}
              {scanStatus === 'success' && 'Student registered successfully!'}
              {scanStatus === 'error' && 'Please try again'}
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
