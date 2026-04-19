import { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { Users, UserCheck, UserMinus, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [processingAbsent, setProcessingAbsent] = useState(false);

  async function fetchStats() {
    if (!user) return;
    setLoading(true);
    try {
      // Get all students
      const stuQ = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
      const stuSnap = await getDocs(stuQ);
      const totalStudents = stuSnap.size;

      // Get today's attendance
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const attQ = query(collection(db, 'attendance_records'), 
        where('teacherUid', '==', user.uid),
        where('date', '==', todayStr)
      );
      const attSnap = await getDocs(attQ);
      
      let presentCount = 0;
      let absentCount = 0;

      attSnap.forEach(doc => {
        if (doc.data().status === 'present') presentCount++;
        if (doc.data().status === 'absent') absentCount++;
      });

      setStats({
        total: totalStudents,
        present: presentCount,
        absent: absentCount
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, [user]);

  const markAbsentees = async () => {
    if (!user || !window.confirm("Are you sure? This will mark all unscanned students as absent for today.")) return;
    
    setProcessingAbsent(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      const stuQ = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
      const stuSnap = await getDocs(stuQ);
      
      const attQ = query(collection(db, 'attendance_records'), 
        where('teacherUid', '==', user.uid),
        where('date', '==', todayStr)
      );
      const attSnap = await getDocs(attQ);
      
      const loggedStudentIds = new Set();
      attSnap.forEach(doc => loggedStudentIds.add(doc.data().studentId));

      const missingStudents: string[] = [];
      stuSnap.forEach(doc => {
        if (!loggedStudentIds.has(doc.id)) {
          missingStudents.push(doc.id);
        }
      });

      // Add absent records
      for (const studentId of missingStudents) {
        await addDoc(collection(db, 'attendance_records'), {
          studentId: studentId,
          date: todayStr,
          status: 'absent',
          timestamp: Date.now(),
          teacherUid: user.uid
        });
      }

      await fetchStats();
      
    } catch (e) {
      console.error("Failed to mark absentees", e);
      alert("Failed to mark absentees. " + (e as Error).message);
    } finally {
      setProcessingAbsent(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">System Overview</h2>
          <p className="text-gray-500 mt-1">Daily statistics for {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
        <button 
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Registered" value={stats.total} icon={<Users className="w-5 h-5 text-gray-600" />} />
        <StatCard title="Present Today" value={stats.present} icon={<UserCheck className="w-5 h-5 text-green-600" />} trend="present" />
        <StatCard title="Absent Today" value={stats.absent} icon={<UserMinus className="w-5 h-5 text-red-600" />} trend="absent" />
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex-1">
        <div className="max-w-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Finalize Daily Attendance</h3>
          <p className="text-gray-500 text-sm mb-6">
            If scanning for the day is complete, you can automatically mark all students who have not been scanned as absent.
            This ensures accurate logs.
          </p>
          
          <div className="flex items-start gap-4 p-4 bg-orange-50 border border-orange-100 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-900">Important</p>
              <p className="text-sm text-orange-800 mt-1">
                There are {stats.total - (stats.present + stats.absent)} students without any log for today.
              </p>
            </div>
          </div>

          <button
            onClick={markAbsentees}
            disabled={processingAbsent || (stats.total - (stats.present + stats.absent)) === 0}
            className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl py-3 px-6 font-medium transition-colors"
          >
            {processingAbsent ? <RefreshCw className="w-5 h-5 animate-spin" /> : <UserMinus className="w-5 h-5" />}
            Mark Unscanned as Absent
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: number, icon: React.ReactNode, trend?: 'present' | 'absent' }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <span className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
          {icon}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-light text-gray-900 font-mono tracking-tight">{value}</p>
      </div>
    </div>
  );
}
