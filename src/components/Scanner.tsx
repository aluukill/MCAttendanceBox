import { useEffect, useRef, useState, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Student } from '../types';
import { Loader2, Camera, ShieldCheck, UserCheck, RotateCcw, Clock, Play, AlertCircle, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import { useToast } from './Toast';

interface Settings {
  lateCutoffTime: string;
}

interface StudentWithDescriptor {
  id: string;
  name: string;
  descriptor: Float32Array;
}

interface DetectedFace {
  name: string | null;
  confidence: number;
  isMatch: boolean;
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
  
  // Debug/tracking states
  const [loadedStudents, setLoadedStudents] = useState<StudentWithDescriptor[]>([]);
  const [currentDetection, setCurrentDetection] = useState<DetectedFace | null>(null);
  const [studentsCount, setStudentsCount] = useState(0);
  
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const loggedTodayRef = useRef<Set<string>>(new Set());
  const scanningTimerRef = useRef<number | null>(null);
  const lateCutoffTimeRef = useRef(lateCutoffTime);
  const lastMatchedRef = useRef<string | null>(null);
  const matchCooldownRef = useRef<number>(0);
  const videoReadyRef = useRef(false);

  useEffect(() => {
    lateCutoffTimeRef.current = lateCutoffTime;
  }, [lateCutoffTime]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const resetMatchCooldown = () => {
    matchCooldownRef.current = Date.now();
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
        console.error('Error loading settings:', e);
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
          setInitStatus('No students registered');
          setStudentsCount(0);
          return;
        }
        
        const students: StudentWithDescriptor[] = [];
        let validCount = 0;
        
        snap.forEach(d => {
          const data = d.data() as Student;
          if (data.faceDescriptor && Array.isArray(data.faceDescriptor) && data.faceDescriptor.length === 128) {
            try {
              const descArray = new Float32Array(data.faceDescriptor);
              students.push({
                id: d.id,
                name: data.name,
                descriptor: descArray
              });
              validCount++;
            } catch (e) {
              console.warn('Failed to create Float32Array for student:', d.id, e);
            }
          }
        });
        
        setLoadedStudents(students);
        setStudentsCount(validCount);
        
        if (validCount === 0) {
          setInitStatus('No valid face data found');
          return;
        }
        
        // Create FaceMatcher with more lenient threshold (0.65)
        const labeledDescriptors = students.map(s => 
          new faceapi.LabeledFaceDescriptors(s.id + '||' + s.name, [s.descriptor])
        );
        faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.65);
        
        if (!active) return;
        
        // Load today's attendance
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
        console.error('Scanner initialization error:', err);
        if (active) setInitStatus('Initialization failed');
      }
    }

    initialize();

    return () => {
      active = false;
      if (scanningTimerRef.current) {
        clearInterval(scanningTimerRef.current);
        scanningTimerRef.current = null;
      }
    };
  }, [user]);

  // Scanning effect
  useEffect(() => {
    if (!isReady || !scanningStarted || !faceMatcherRef.current) {
      if (scanningTimerRef.current) {
        clearInterval(scanningTimerRef.current);
        scanningTimerRef.current = null;
      }
      return;
    }

    const scan = async () => {
      // Wait for cooldown (3 seconds after a successful match)
      if (Date.now() - matchCooldownRef.current < 3000 && lastMatchedRef.current) {
        return;
      }

      if (!webcamRef.current?.video) return;
      
      const videoEl = webcamRef.current.video;
      if (videoEl.readyState !== 4) {
        videoReadyRef.current = false;
        return;
      }
      videoReadyRef.current = true;

      try {
        const detections = await faceapi
          .detectAllFaces(
            videoEl,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.25 })
          )
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length === 0) {
          setCurrentDetection(null);
          return;
        }

        // Process first detected face
        const det = detections[0];
        const bestMatch = faceMatcherRef.current.findBestMatch(det.descriptor);
        
        if (bestMatch.label === 'unknown') {
          setCurrentDetection({
            name: null,
            confidence: (1 - bestMatch.distance) * 100,
            isMatch: false
          });
        } else {
          const [studentDocId, studentName] = bestMatch.label.split('||');
          const confidence = (1 - bestMatch.distance) * 100;
          
          setCurrentDetection({
            name: studentName,
            confidence,
            isMatch: true
          });

          // Only mark attendance if not already logged and not in cooldown
          if (!loggedTodayRef.current.has(studentDocId) && lastMatchedRef.current !== studentDocId) {
            loggedTodayRef.current.add(studentDocId);
            lastMatchedRef.current = studentDocId;
            resetMatchCooldown();
            
            const now = new Date();
            const status = isLate(now) ? 'late_present' : 'present';
            
            try {
              await addDoc(collection(db, 'attendance_records'), {
                studentId: studentDocId,
                studentName,
                date: format(now, 'yyyy-MM-dd'),
                status,
                timestamp: Date.now(),
                teacherUid: user?.uid
              });
              
              setRecognizedStudents(prev => [{ 
                id: studentDocId, 
                name: studentName, 
                time: now, 
                status, 
                alreadyTracked: false 
              }, ...prev]);
              
              showToast(`${studentName} marked as ${status === 'late_present' ? 'Late' : 'Present'}`, 'success');
            } catch (err: any) {
              console.error('Failed to save attendance:', err);
              showToast('Failed to save: ' + (err.message || 'Unknown error'), 'error');
              // Allow retry by removing from logged set
              loggedTodayRef.current.delete(studentDocId);
              lastMatchedRef.current = null;
            }
            
            // Clear detection display after marking
            setTimeout(() => setCurrentDetection(null), 2000);
          }
        }
      } catch (e) {
        console.error('Face scan error:', e);
      }
    };

    scanningTimerRef.current = window.setInterval(scan, 1000);

    return () => {
      if (scanningTimerRef.current) {
        clearInterval(scanningTimerRef.current);
        scanningTimerRef.current = null;
      }
    };
  }, [isReady, scanningStarted, user]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Face Scanner</h2>
          <p className="text-gray-500 mt-1">
            {!timeConfigured 
              ? 'Set time first' 
              : !isReady 
                ? 'Loading...'
                : studentsCount === 0 
                  ? 'No students to scan'
                  : scanningStarted 
                    ? `${studentsCount} student${studentsCount > 1 ? 's' : ''} loaded`
                    : 'Ready to scan'}
          </p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            timeConfigured 
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200' 
              : 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 shadow-sm'
          }`}
          title="Set late cutoff time"
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">
            {timeConfigured ? `Cutoff: ${lateCutoffTime}` : 'Set Time'}
          </span>
        </button>
      </div>

      {timeConfigured && isReady && studentsCount > 0 && !scanningStarted && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setScanningStarted(true)}
            className="flex items-center gap-2.5 bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-xl font-medium transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-600/25"
          >
            <Play className="w-5 h-5" />
            Start Scanning
          </button>
        </div>
      )}

      <div className="flex-1 grid md:grid-cols-[2fr_1fr] gap-4 md:gap-6 min-h-[400px] md:min-h-[500px]">
        {/* Camera Section */}
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          {!isReady ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-2xl">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-gray-300" />
              <p className="font-medium text-sm text-gray-500">{initStatus}</p>
            </div>
          ) : studentsCount === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-2xl">
              <AlertCircle className="w-12 h-12 mb-4 text-amber-400" />
              <p className="font-medium text-gray-600 mb-1">No students registered</p>
              <p className="text-sm text-gray-400">Register students first to start scanning</p>
            </div>
          ) : (
            <div className="relative flex-1 bg-gray-900 rounded-2xl overflow-hidden">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                mirrored={true}
                className="w-full h-full object-cover"
                onUserMedia={() => setWebcamError(null)}
                onError={() => setWebcamError('Camera error')}
              />
              
              {/* Scanning Status Indicator */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md ${
                  scanningStarted ? 'bg-green-600/90' : 'bg-gray-800/80'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    scanningStarted ? 'bg-white animate-pulse' : 'bg-gray-400'
                  }`} />
                  <span className="text-white text-sm font-medium">
                    {scanningStarted ? 'Scanning' : 'Standby'}
                  </span>
                </div>
                
                {scanningStarted && currentDetection && (
                  <div className={`px-4 py-2 rounded-full backdrop-blur-md ${
                    currentDetection.isMatch ? 'bg-green-600/90' : 'bg-amber-600/90'
                  }`}>
                    <span className="text-white text-sm font-medium">
                      {currentDetection.isMatch ? currentDetection.name : 'Unknown'}
                    </span>
                  </div>
                )}
              </div>

              {/* Camera Toggle */}
              <button
                onClick={toggleCamera}
                className="absolute bottom-4 right-4 p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
              >
                <RotateCcw className="w-5 h-5 text-white" />
              </button>

              {/* Face Detection Box */}
              {scanningStarted && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-48 h-48 rounded-2xl border-2 transition-all duration-300 ${
                    currentDetection?.isMatch 
                      ? 'border-green-500 shadow-lg shadow-green-500/50 animate-pulse' 
                      : currentDetection 
                        ? 'border-amber-500' 
                        : 'border-white/30'
                  }`}>
                    {currentDetection && (
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                          currentDetection.isMatch ? 'bg-green-500' : 'bg-amber-500'
                        } text-white`}>
                          {currentDetection.isMatch 
                            ? `${Math.round(currentDetection.confidence)}% match` 
                            : 'No match'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Webcam Error Overlay */}
              {webcamError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                  <Camera className="w-12 h-12 mb-4 text-red-400" />
                  <p className="text-sm mb-4">{webcamError}</p>
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
          )}
        </div>

        {/* Attendance Log Section */}
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Today's Log</h3>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {recognizedStudents.filter(e => !e.alreadyTracked).length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {recognizedStudents.filter(e => !e.alreadyTracked).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                <ShieldCheck className="w-10 h-10 mb-3 text-gray-200" />
                <p className="text-sm">No attendance logged</p>
                <p className="text-xs text-gray-300 mt-1">Start scanning to record</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recognizedStudents.filter(e => !e.alreadyTracked).map((entry, idx) => (
                  <div 
                    key={`${entry.id}-${idx}`} 
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      entry.status === 'late_present' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{entry.name}</p>
                      <p className="text-xs text-gray-500">{format(entry.time, 'h:mm a')}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
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

      {/* Time Setup Dialog */}
      <Dialog.Root open={showTimePrompt && !timeConfigured && isReady} onOpenChange={(open) => !open && setShowTimePrompt(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 w-full max-w-sm z-50 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">Set Late Cutoff</Dialog.Title>
            </div>
            <p className="text-sm text-gray-500 mb-4">Students arriving after this time will be marked as late.</p>
            <input
              type="time"
              value={lateCutoffTime}
              onChange={(e) => setLateCutoffTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
            />
            <button
              onClick={saveSettings}
              className="w-full py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors"
            >
              Continue
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Settings Dialog */}
      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 w-full max-w-sm z-50 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Settings</Dialog.Title>
            <p className="text-sm text-gray-500 mb-4">Students arriving after cutoff time will be marked as late.</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Late Cutoff Time</label>
            <input
              type="time"
              value={lateCutoffTime}
              onChange={(e) => setLateCutoffTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
            />
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={saveSettings}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors"
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