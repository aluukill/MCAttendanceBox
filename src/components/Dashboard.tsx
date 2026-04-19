import { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { Users, UserCheck, UserMinus, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay, parseISO } from 'date-fns';

interface Student {
  id: string;
  name: string;
  studentId: string;
}

interface AttendanceRecord {
  studentId: string;
  date: string;
  status: 'present' | 'absent';
}

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [processingAbsent, setProcessingAbsent] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  async function fetchData() {
    if (!user) return;
    setLoading(true);
    try {
      // Get all students
      const stuQ = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
      const stuSnap = await getDocs(stuQ);
      const studentList: Student[] = [];
      stuSnap.forEach(doc => {
        studentList.push({
          id: doc.id,
          name: doc.data().name,
          studentId: doc.data().studentId
        });
      });
      setStudents(studentList);

      // Get attendance for current month
      const attQ = query(collection(db, 'attendance_records'), 
        where('teacherUid', '==', user.uid)
      );
      const attSnap = await getDocs(attQ);
      
      const attMap = new Map<string, AttendanceRecord>();
      attSnap.forEach(doc => {
        const data = doc.data();
        const date = data.date;
        const recordDate = parseISO(date);
        if (recordDate >= monthStart && recordDate <= monthEnd) {
          const key = `${data.studentId}-${date}`;
          attMap.set(key, {
            studentId: data.studentId,
            date: data.date,
            status: data.status
          });
        }
      });
      setAttendance(attMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [user, currentMonth]);

  const getAttendanceStatus = (studentId: string, date: Date): 'present' | 'absent' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${studentId}-${dateStr}`;
    const record = attendance.get(key);
    return record?.status || null;
  };

  const getMonthStats = (studentId: string) => {
    let present = 0;
    let absent = 0;
    daysInMonth.forEach(day => {
      const status = getAttendanceStatus(studentId, day);
      if (status === 'present') present++;
      if (status === 'absent') absent++;
    });
    return { present, absent };
  };

  const getOverallStats = () => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalPossible = students.length * daysInMonth.length;
    let marked = 0;
    
    students.forEach(student => {
      const stats = getMonthStats(student.id);
      totalPresent += stats.present;
      totalAbsent += stats.absent;
      marked += stats.present + stats.absent;
    });

    return { totalPresent, totalAbsent, totalPossible, marked };
  };

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

      for (const studentId of missingStudents) {
        await addDoc(collection(db, 'attendance_records'), {
          studentId: studentId,
          date: todayStr,
          status: 'absent',
          timestamp: Date.now(),
          teacherUid: user.uid
        });
      }

      await fetchData();
      
    } catch (e) {
      console.error("Failed to mark absentees", e);
      alert("Failed to mark absentees. " + (e as Error).message);
    } finally {
      setProcessingAbsent(false);
    }
  };

  const overallStats = getOverallStats();

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Attendance Dashboard</h2>
          <p className="text-gray-500 mt-1 text-xs md:text-sm">
            {format(currentMonth, 'MMMM yyyy')} • {students.length} students
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[100px] md:min-w-[120px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 md:ml-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <div className="w-8 md:w-10 h-8 md:h-10 bg-blue-50 rounded-lg md:rounded-xl flex items-center justify-center">
              <Users className="w-4 md:w-5 h-4 md:h-5 text-blue-600" />
            </div>
            <span className="text-xs md:text-sm text-gray-500">Total Students</span>
          </div>
          <p className="text-xl md:text-2xl font-semibold text-gray-900">{students.length}</p>
        </div>
        
        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <div className="w-8 md:w-10 h-8 md:h-10 bg-green-50 rounded-lg md:rounded-xl flex items-center justify-center">
              <UserCheck className="w-4 md:w-5 h-4 md:h-5 text-green-600" />
            </div>
            <span className="text-xs md:text-sm text-gray-500">Total Present</span>
          </div>
          <p className="text-xl md:text-2xl font-semibold text-green-600">{overallStats.totalPresent}</p>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <div className="w-8 md:w-10 h-8 md:h-10 bg-red-50 rounded-lg md:rounded-xl flex items-center justify-center">
              <UserMinus className="w-4 md:w-5 h-4 md:h-5 text-red-600" />
            </div>
            <span className="text-xs md:text-sm text-gray-500">Total Absent</span>
          </div>
          <p className="text-xl md:text-2xl font-semibold text-red-600">{overallStats.totalAbsent}</p>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <div className="w-8 md:w-10 h-8 md:h-10 bg-gray-100 rounded-lg md:rounded-xl flex items-center justify-center">
              <AlertCircle className="w-4 md:w-5 h-4 md:h-5 text-gray-600" />
            </div>
            <span className="text-xs md:text-sm text-gray-500">Attendance Rate</span>
          </div>
          <p className="text-xl md:text-2xl font-semibold text-gray-900">
            {overallStats.marked > 0 
              ? Math.round((overallStats.totalPresent / overallStats.marked) * 100) 
              : 0}%
          </p>
        </div>
      </div>

      {/* Mark Absent Banner */}
      {format(new Date(), 'yyyy-MM') === format(currentMonth, 'yyyy-MM') && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 md:p-4 mb-4 md:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-orange-900">Mark Today's Absentees</p>
              <p className="text-xs text-orange-700">
                {students.length - (overallStats.totalPresent / daysInMonth.length || 0) - overallStats.totalAbsent || 0 > 0 
                  ? `${Math.round(students.length - (overallStats.totalPresent / daysInMonth.length || 0) - (overallStats.totalAbsent || 0))} students without logs` 
                  : 'All students have attendance records'}
              </p>
            </div>
          </div>
          <button
            onClick={markAbsentees}
            disabled={processingAbsent}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
          >
            {processingAbsent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
            Mark Unscanned as Absent
          </button>
        </div>
      )}

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[800px] md:min-w-[1000px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2 md:p-4 font-medium text-gray-600 text-xs md:text-sm border-b">Student</th>
                <th className="text-center p-2 md:p-4 font-medium text-gray-600 text-xs md:text-sm border-b w-20 md:w-24">Present</th>
                <th className="text-center p-2 md:p-4 font-medium text-gray-600 text-xs md:text-sm border-b w-20 md:w-24">Absent</th>
                {daysInMonth.map(day => (
                  <th key={day.toISOString()} className="text-center p-1 md:p-2 font-medium text-gray-500 text-[10px] md:text-xs border-b w-6 md:w-8">
                    <div className="hidden md:block transform -rotate-45 origin-center">{format(day, 'd')}</div>
                    <div className="md:hidden">{format(day, 'd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={daysInMonth.length + 3} className="p-4 md:p-8 text-center">
                    <RefreshCw className="w-5 md:w-6 h-5 md:h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth.length + 3} className="p-4 md:p-8 text-center text-gray-500 text-xs md:text-sm">
                    No students registered. Register students to see attendance.
                  </td>
                </tr>
              ) : (
                students.map(student => {
                  const stats = getMonthStats(student.id);
                  return (
                    <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-2 md:p-3">
                        <div>
                          <p className="font-medium text-gray-900 text-xs md:text-sm truncate max-w-[80px] md:max-w-none">{student.name}</p>
                          <p className="text-[10px] md:text-xs text-gray-500">{student.studentId}</p>
                        </div>
                      </td>
                      <td className="text-center p-2 md:p-3">
                        <span className="inline-flex items-center gap-0.5 md:gap-1 text-green-600 font-medium text-xs md:text-sm">
                          <UserCheck className="w-3 md:w-4 h-3 md:h-4" /> <span className="hidden sm:inline">{stats.present}</span>
                        </span>
                      </td>
                      <td className="text-center p-2 md:p-3">
                        <span className="inline-flex items-center gap-0.5 md:gap-1 text-red-600 font-medium text-xs md:text-sm">
                          <UserMinus className="w-3 md:w-4 h-3 md:h-4" /> <span className="hidden sm:inline">{stats.absent}</span>
                        </span>
                      </td>
                      {daysInMonth.map(day => {
                        const status = getAttendanceStatus(student.id, day);
                        const isToday = isSameDay(day, new Date());
                        return (
                          <td key={day.toISOString()} className="text-center p-0.5 md:p-1">
                            <div 
                              className={`w-5 h-5 md:w-6 md:h-6 rounded flex items-center justify-center text-[10px] md:text-xs font-medium ${
                                status === 'present' 
                                  ? 'bg-green-100 text-green-700' 
                                  : status === 'absent' 
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-50 text-gray-300'
                              } ${isToday ? 'ring-1 md:ring-2 ring-blue-400 ring-offset-0.5 md:ring-offset-1' : ''}`}
                              title={`${format(day, 'MMM d')}: ${status || 'No record'}`}
                            >
                              {status === 'present' ? '✓' : status === 'absent' ? '✗' : '·'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
