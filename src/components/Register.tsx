import { useState, useRef, useEffect, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Loader2, Camera, CheckCircle2, AlertCircle, ScanFace, User } from 'lucide-react';

export default function Register() {
  const { user } = useContext(AuthContext);
  const webcamRef = useRef<Webcam>(null);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [showCamera, setShowCamera] = useState(false);

  // Show camera only when both fields have content
  useEffect(() => {
    if (name.trim() && studentId.trim()) {
      setShowCamera(true);
    }
  }, [name, studentId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !studentId) {
      setStatus({ type: 'error', message: 'Please fill out all fields.' });
      return;
    }
    if (!webcamRef.current || !webcamRef.current.video) {
      setStatus({ type: 'error', message: 'Webcam not ready.' });
      return;
    }

    setIsRegistering(true);
    setStatus({ type: 'idle', message: 'Detecting face...' });

    try {
      const videoEl = webcamRef.current.video;
      
      const detections = await faceapi.detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setStatus({ type: 'error', message: 'No face detected in the frame. Please look directly at the camera.' });
        setIsRegistering(false);
        return;
      }

      if (detections.length > 1) {
        setStatus({ type: 'error', message: 'Multiple faces detected. Please ensure only the student is in the frame.' });
        setIsRegistering(false);
        return;
      }

      const descriptor = Array.from(detections[0].descriptor);

      await addDoc(collection(db, 'students'), {
        name,
        studentId,
        faceDescriptor: descriptor,
        teacherUid: user?.uid,
        createdAt: Date.now()
      });

      setStatus({ type: 'success', message: `Successfully registered ${name}.` });
      setName('');
      setStudentId('');
      setShowCamera(false);
    } catch (err: any) {
      setStatus({ type: 'error', message: `Error registering student: ${err.message}` });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-full">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Register Student</h2>
        <p className="text-gray-500 mt-1">Enroll a new student. Fill the form below and camera will activate.</p>
      </div>

      <div className="flex-1 grid lg:grid-cols-[2fr_1fr] gap-8 min-h-[500px]">
        {/* Camera Area - same style as Scanner */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          {!showCamera ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
              <User className="w-12 h-12 mb-4 text-gray-300" />
              <p className="font-medium text-sm">Fill the form to activate camera</p>
              <p className="text-xs text-gray-400 mt-1">Enter name and student ID to continue</p>
            </div>
          ) : (
            <div className="relative flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-semibold uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Ready to Capture
              </div>
              <div className="absolute inset-0 pointer-events-none border-[1px] border-dashed border-white/20 m-12 rounded-[50px] opacity-30"></div>
            </div>
          )}
        </div>

        {/* Form Area */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <form onSubmit={handleRegister} className="flex flex-col h-full">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all text-sm"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID / Roll Number</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all text-sm"
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
                type="submit"
                disabled={!showCamera || isRegistering}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl py-3.5 px-6 font-medium transition-colors mt-auto"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ScanFace className="w-5 h-5" />
                    Capture & Register
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}