import { useState, useContext } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { BrainCircuit, Loader2, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function AIInsights() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [insightData, setInsightData] = useState<string>('');
  const [error, setError] = useState<string>('');

  const generateInsights = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    setInsightData('');

    try {
      // Gather all data
      const stuQ = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
      const stuSnap = await getDocs(stuQ);
      const students: Record<string, any> = {};
      stuSnap.forEach(doc => {
        const d = doc.data();
        students[doc.id] = { name: d.name, studentId: d.studentId };
      });

      const attQ = query(collection(db, 'attendance_records'), where('teacherUid', '==', user.uid));
      const attSnap = await getDocs(attQ);
      const records = attSnap.docs.map(doc => {
        const d = doc.data();
        return {
          date: d.date,
          status: d.status,
          studentName: students[d.studentId]?.name || 'Unknown'
        };
      });

      if (records.length === 0) {
        setError("Not enough attendance data to generate insights.");
        setLoading(false);
        return;
      }

      // Prepare Prompt
      const dataStr = JSON.stringify(records);
      const prompt = `
You are an expert educational AI analyst. Here is the raw attendance data for my students:
${dataStr}

Please analyze this data to:
1. Identify any patterns in absences (e.g., specific days of the week).
2. Flag students who are chronically absent.
3. Provide actionable recommendations to improve attendance.
4. Give a brief, high-level summary of the overall attendance health of the class.

Format your response in Markdown, making it easy to read for a school administrator.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });

      setInsightData(response.text || '');
    } catch (e: any) {
      console.error(e);
      setError(`Failed to generate insights: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">AI Attendance Insights</h2>
        <p className="text-gray-500 mt-1">Leverage Gemini's high-level reasoning to analyze attendance trends and patterns.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
         <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
               <BrainCircuit className="w-5 h-5" />
             </div>
             <div>
               <h3 className="font-semibold text-gray-900">Cognitive Analysis Engine</h3>
               <p className="text-xs text-gray-500">Powered by Gemini 3.1 Pro</p>
             </div>
           </div>
           
           <button
             onClick={generateInsights}
             disabled={loading}
             className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
           >
             {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
             {loading ? "Analyzing Data..." : "Run Analysis"}
           </button>
         </div>

         <div className="flex-1 overflow-y-auto p-8">
           {loading ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <BrainCircuit className="w-12 h-12 mb-4 animate-pulse text-blue-200" />
               <p className="text-sm font-medium">Processing student presence patterns...</p>
               <p className="text-xs mt-2 text-gray-400 max-w-sm text-center">
                 Using deep reasoning to analyze the entire attendance history. This may take a moment.
               </p>
             </div>
           ) : error ? (
             <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
               {error}
           </div>
           ) : insightData ? (
             <div className="prose prose-blue max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-blue-600">
               <ReactMarkdown>{insightData}</ReactMarkdown>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <p className="text-sm">Click "Run Analysis" to generate deep insights.</p>
             </div>
           )}
         </div>
      </div>
    </div>
  );
}
