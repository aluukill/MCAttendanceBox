import { useState, useRef, useEffect, useContext } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { loadFaceApiModels } from '../lib/face-api-loader';
import { Loader2, Camera, CheckCircle2, AlertCircle, ScanFace } from 'lucide-react';

export default function Register() {
  const { user } = useContext(AuthContext);
  const webcamRef = useRef<Webcam>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  useEffect(() => {
    loadFaceApiModels().then(() => {
      setLoadingModels(false);
    }).catch((err) => {
      setStatus({ type: 'error', message: 'Failed to load face detection models.' });
    });
  }, []);

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
    } catch (err: any) {
      setStatus({ type: 'error', message: `Error registering student: ${err.message}` });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Register Student</h2>
        <p className="text-gray-500 mt-1">Enroll a new student by capturing their facial signature.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 grid md:grid-cols-2 gap-12">
        {/* Webcam Area */}
        <div className="flex flex-col gap-4">
          <div className="relative bg-gray-100 rounded-2xl overflow-hidden aspect-video flex-shrink-0 flex justify-center border border-gray-200">
            {loadingModels ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-gray-900" />
                <p className="text-sm font-medium">Loading neural models...</p>
              </div>
            ) : (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl flex items-start gap-3 border border-blue-100">
            <Camera className="w-5 h-5 flex-shrink-0" />
            <div>Ensure the room is well lit. The student should face the camera directly with a neutral expression.</div>
          </div>
        </div>

        {/* Form Area */}
        <form onSubmit={handleRegister} className="flex flex-col justify-center">
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
              disabled={loadingModels || isRegistering}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full py-3.5 px-6 font-medium transition-colors"
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
  );
}
