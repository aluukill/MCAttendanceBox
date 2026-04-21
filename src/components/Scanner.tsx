import { useEffect, useRef, useState, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Student } from '../types';
import { Loader2, Camera, ShieldCheck, UserCheck, RotateCcw, Clock, Play, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import { useToast } from './Toast';

interface Settings {
  lateCutoffTime: string;
}

export default function Scanner() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  
  const [initStatus, setInitStatus] = useState<string>('Loading models...');
  const [isReady, setIsReady] = useState(false);
  const [scanningStarted, setScanningStarted] = useState(false);
  const [timeConfigured, setTimeConfigured] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [recognizedStudents, setRecognizedStudents] = useState<{ id: string, name: string, time: Date, status: string, alreadyTracked?: boolean }[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTimePrompt, setShowTimePrompt] = useState(false);
  const [lateCutoffTime, setLateCutoffTime] = useState('09:00');
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [initError, setInitError] = useState(false);
  
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const loggedTodayRef = useRef<Set<string>>(new Set());
  const scanningTimerRef = useRef<any>(null);
  const lateCutoffTimeRef = useRef(lateCutoffTime);

  useEffect(() => {
    lateCutoffTimeRef.current = lateCutoffTime;
  }, [lateCutoffTime]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', user.uid));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as Settings;
          setLateCutoffTime(data.lateCutoffTime || '09:00');
          setTimeConfigured(true);
        } else {
          setSettingsOpen(true);
        }
      } catch (e) {
        console.error(e);
        setSettingsOpen(true);
      }
    };
    loadSettings();
  }, [user]);

  useEffect(() => {
    if (!timeConfigured && isReady) {
      setShowTimePrompt(true);
    }
  }, [timeConfigured, isReady]);

  const saveSettings = async () => {
    if (!user || !user.uid) {
      showToast('Not logged in', 'error');
      return;
    }
    try {
      const settingsRef = doc(db, 'settings', user.uid);
      await setDoc(settingsRef, { lateCutoffTime }, { merge: true });
      setTimeConfigured(true);
      setSettingsOpen(false);
      showToast('Time set successfully', 'success');
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const isLate = (time: Date): boolean => {
    const cutoffTime = lateCutoffTimeRef.current;
    const [hours, minutes] = cutoffTime.split(':').map(Number);
    const cutoffDate = new Date(time);
    cutoffDate.setHours(hours, minutes, 0, 0);
    return time > cutoffDate;
  };

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setInitStatus('Loading neural models...');
        await loadFaceApiModels();
        setLoadingModels(false);
        
        if (!active) return;
        
        if (!user) return;
        
        setInitStatus('Loading student profiles...');
        
        const q = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setInitStatus('No students registered. Please register students first.');
          return;
        }
        
        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
        let studentCount = 0;
        snap.forEach(d => {
          const data = d.data() as Student;
          if (data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128) {
            const descArray = new Float32Array(data.faceDescriptor);
            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(d.id + '||' + data.name, [descArray]));
            studentCount++;
          } else {
            console.warn('Invalid face descriptor for student:', d.id, data);
          }
        });
        console.log('Loaded', studentCount, 'students with face descriptors');

        faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
        
        if (!active) return;
        
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const attQ = query(collection(db, 'attendance_records'), 
          where('teacherUid', '==', user.uid),
          where('date', '==', todayStr)
        );
        const attSnap = await getDocs(attQ);
        attSnap.forEach(d => {
          loggedTodayRef.current.add(d.data().studentId);
        });

        setIsReady(true);
        setInitStatus('');
      } catch (err) {
        console.error(err);
        if (active) setInitStatus('Initialization failed. Check console.');
      }
    }

    initialize();

    return () => {
      active = false;
      if (scanningTimerRef.current) clearInterval(scanningTimerRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (!isReady || !webcamRef.current || !scanningStarted || !faceMatcherRef.current) return;

    const scan = async () => {
      if (!webcamRef.current || !webcamRef.current.video) return;
      
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

        console.log('Faces detected:', detections.length);

        if (detections.length === 0) return;

        for (const det of detections) {
          console.log('Descriptor length:', det.descriptor.length);
          const bestMatch = faceMatcherRef.current!.findBestMatch(det.descriptor);
          console.log('Best match:', bestMatch.label, 'distance:', bestMatch.distance);
          
          if (bestMatch.label !== 'unknown') {
            const [studentDocId, studentName] = bestMatch.label.split('||');
            
            if (!loggedTodayRef.current.has(studentDocId)) {
              loggedTodayRef.current.add(studentDocId);
              
              const now = new Date();
              const status = isLate(now) ? 'late_present' : 'present';
              
              await addDoc(collection(db, 'attendance_records'), {
                studentId: studentDocId,
                studentName,
                date: format(now, 'yyyy-MM-dd'),
                status,
                timestamp: Date.now(),
                teacherUid: user?.uid
              });
              
              setRecognizedStudents(prev => [{ id: studentDocId, name: studentName, time: now, status, alreadyTracked: false }, ...prev]);
              showToast(`${studentName} marked as ${status === 'late_present' ? 'Late' : 'Present'}`, 'success');
            } else {
              setRecognizedStudents(prev => prev.map(s => 
                s.id === studentDocId ? { ...s, alreadyTracked: true } : s
              ));
            }
          }
        }
      } catch (e) {
        console.error('Face scan error:', e);
      }
    };

    scanningTimerRef.current = setInterval(scan, 1500);

    return () => {
      if (scanningTimerRef.current) clearInterval(scanningTimerRef.current);
    };
  }, [isReady, user, scanningStarted]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Scanner Mode</h2>
          <p className="text-gray-500 mt-1">
            {!timeConfigured 
              ? 'Set time first to configure cutoff' 
              : scanningStarted 
                ? 'Scanning in progress...'
                : 'Ready to scan'}
          </p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`p-2 rounded-full transition-colors ${timeConfigured ? 'hover:bg-gray-100' : 'bg-amber-100 text-amber-600'}`}
          title="Set late cutoff time"
        >
          <Clock className="w-5 h-5" />
        </button>
      </div>

      {timeConfigured && isReady && !scanningStarted && (
        <div className="mb-4 flex justify-center">
          <button
            onClick={() => {
              setScanningStarted(true);
            }}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <Play className="w-5 h-5" />
            Start Scanning
          </button>
        </div>
      )}

      <div className="flex-1 grid md:grid-cols-[2fr_1fr] gap-4 md:gap-8 min-h-[400px] md:min-h-[500px]">
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          {loadingModels || !isReady ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
              {initStatus.includes('failed') || initStatus.includes('No students') ? (
                <div className="text-center p-4">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                  <p className="font-medium text-sm text-red-600 mb-2">{initStatus}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
                  >
                    Reload Page
                  </button>
                </div>
              ) : (
                <>
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-gray-900" />
                  <p className="font-medium text-sm">{initStatus}</p>
                </>
              )}
            </div>
          ) : (
            <div className="relative flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <div className="relative aspect-square max-w-sm mx-auto w-full">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode }}
                  mirrored={true}
                  className="w-full h-full object-cover rounded-2xl"
                  onUserMedia={() => setWebcamError(null)}
                  onError={(err) => {
                    console.error('Webcam error:', err);
                    setWebcamError('Camera access denied or not available. Please allow camera permissions.');
                  }}
                />
                {webcamError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
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
                <button
                  onClick={toggleCamera}
                  className="absolute bottom-4 right-4 p-3 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors"
                >
                  <RotateCcw className="w-5 h-5 text-white" />
                </button>
                <div className="absolute inset-0 pointer-events-none border-[1px] border-dashed border-white/30 m-8 rounded-full opacity-50" />
              </div>
              
              <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-semibold uppercase tracking-wider">
                {scanningStarted ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Scanning Active
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    Ready
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Today's Log</h3>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {recognizedStudents.filter(e => !e.alreadyTracked).length} new
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 md:space-y-3 max-h-[200px] md:max-h-none">
            {!timeConfigured ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Clock className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm">Set time first</p>
              </div>
            ) : recognizedStudents.filter(e => !e.alreadyTracked).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShieldCheck className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm">No faces scanned</p>
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {recognizedStudents.filter(e => !e.alreadyTracked).map((entry, idx) => (
                  <div key={`${entry.id}-${idx}`} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      entry.status === 'late_present' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      <UserCheck className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{entry.name}</p>
                      <p className="text-xs text-gray-500">{format(entry.time, 'h:mm:ss a')}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      entry.status === 'late_present' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {entry.status === 'late_present' ? 'Late' : 'Present'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog.Root open={showTimePrompt && !timeConfigured && isReady} onOpenChange={(open) => {
          if (!open && !timeConfigured) {
            setShowTimePrompt(false);
          }
        }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 w-full max-w-sm z-50 shadow-2xl">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Set Time First</Dialog.Title>
            <p className="text-sm text-gray-500 mb-4">Please set the late cutoff time before starting the scanner. Students arriving after this time will be marked as "Late Present".</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Late Cutoff Time</label>
              <input
                type="time"
                value={lateCutoffTime}
                onChange={(e) => setLateCutoffTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
              />
            </div>
            <button
              onClick={saveSettings}
              className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium"
            >
              Set Time & Continue
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 w-full max-w-sm z-50 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">Set Late Cutoff Time</Dialog.Title>
            <p className="text-sm text-gray-500 mb-4">Students marked present after this time will be labeled as "Late Present"</p>
            <input
              type="time"
              value={lateCutoffTime}
              onChange={(e) => setLateCutoffTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white mb-4"
            />
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={saveSettings}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium"
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}