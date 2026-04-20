import { useEffect, useRef, useState, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Student } from '../types';
import { Loader2, Camera, ShieldCheck, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function Scanner() {
  const { user } = useContext(AuthContext);
  const webcamRef = useRef<Webcam>(null);
  
  const [initStatus, setInitStatus] = useState<string>('Loading models...');
  const [isReady, setIsReady] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState<{ id: string, name: string, time: Date }[]>([]);
  
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const loggedTodayRef = useRef<Set<string>>(new Set());
  const scanningTimerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setInitStatus('Loading neural models...');
        await loadFaceApiModels();
        
        if (!active) return;
        setInitStatus('Loading student profiles...');
        
        if (!user) return;
        
        // Load students
        const q = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
        const snap = await getDocs(q);
        
        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
        snap.forEach(doc => {
          const data = doc.data() as Student;
          const descArray = new Float32Array(data.faceDescriptor);
          labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(doc.id + '||' + data.name, [descArray]));
        });

        if (labeledDescriptors.length === 0) {
          setInitStatus('No students registered. Please register students first.');
          return;
        }

        faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.5); // 0.5 distance threshold
        
        if (!active) return;
        
        // Load today's attendance to populate loggedTodayRef (so we don't double log on refresh)
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const attQ = query(collection(db, 'attendance_records'), 
          where('teacherUid', '==', user.uid),
          where('date', '==', todayStr),
          where('status', '==', 'present')
        );
        const attSnap = await getDocs(attQ);
        attSnap.forEach(doc => {
          loggedTodayRef.current.add(doc.data().studentId);
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
    if (!isReady || !webcamRef.current) return;

    scanningTimerRef.current = setInterval(async () => {
      if (!webcamRef.current || !webcamRef.current.video) return;
      
      const videoEl = webcamRef.current.video;
      if (videoEl.readyState !== 4) return; // not ready

      try {
        const detections = await faceapi.detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length === 0 || !faceMatcherRef.current) return;

        detections.forEach(async (det) => {
          const bestMatch = faceMatcherRef.current!.findBestMatch(det.descriptor);
          
          if (bestMatch.label !== 'unknown') {
            const [studentDocId, studentName] = bestMatch.label.split('||');
            
            if (!loggedTodayRef.current.has(studentDocId)) {
              // Log attendance
              loggedTodayRef.current.add(studentDocId);
              
              setRecognizedStudents(prev => [{ id: studentDocId, name: studentName, time: new Date() }, ...prev]);
              
              await addDoc(collection(db, 'attendance_records'), {
                studentId: studentDocId,
                date: format(new Date(), 'yyyy-MM-dd'),
                status: 'present',
                timestamp: Date.now(),
                teacherUid: user?.uid
              });
            }
          }
        });
      } catch (e) {
        // ignore occasional inference errors during frame drops
      }
    }, 1000); // scan every 1 second

    return () => {
      if (scanningTimerRef.current) clearInterval(scanningTimerRef.current);
    };
  }, [isReady, user]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col h-full">
      <div className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Scanner Mode</h2>
        <p className="text-gray-500 mt-1">Live facial recognition. Students are automatically logged as present.</p>
      </div>

      <div className="flex-1 grid md:grid-cols-[2fr_1fr] gap-4 md:gap-8 min-h-[400px] md:min-h-[500px]">
        {/* Scanner Feed */}
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          {!isReady ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-gray-900" />
              <p className="font-medium text-sm">{initStatus}</p>
            </div>
          ) : (
            <div className="relative flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center aspect-video md:aspect-auto">
<Webcam
                   ref={webcamRef}
                   audio={false}
                   screenshotFormat="image/jpeg"
                   videoConstraints={{ facingMode: "user" }}
                   mirrored={false}
                   className="w-full h-full object-cover"
                 />
                
                {/* HUD Overlay */}
                <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-semibold uppercase tracking-wider">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Scanner Active
                </div>

                <div className="absolute inset-0 pointer-events-none border-[1px] border-dashed border-white/20 m-12 rounded-[50px] opacity-30"></div>
            </div>
          )}
        </div>

        {/* Recent Recognitions */}
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Today's Log</h3>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {recognizedStudents.length} entries
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 md:space-y-3 max-h-[200px] md:max-h-none">
            {recognizedStudents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShieldCheck className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm">No faces scanned yet today</p>
              </div>
            ) : (
               recognizedStudents.map((entry, idx) => (
                <div key={`${entry.id}-${idx}`} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 bg-gray-50 rounded-xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
                   <div className="w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-green-700">
                     <UserCheck className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{entry.name}</p>
                    <p className="text-xs text-gray-500">{format(entry.time, 'h:mm:ss a')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
