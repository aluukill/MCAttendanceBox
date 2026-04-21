import { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { Student } from '../types';
import { Users, UserCheck, UserMinus, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Download, Calendar, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay, parseISO } from 'date-fns';
import { useToast, useConfirmDialog, ConfirmDialogProvider } from './Toast';

interface AttendanceRecord {
  studentId: string;
  date: string;
  status: 'present' | 'late_present' | 'absent';
}

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const { showConfirm } = useConfirmDialog();
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
      const stuQ = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
      const stuSnap = await getDocs(stuQ);
      const studentList: Student[] = [];
      stuSnap.forEach(doc => {
        studentList.push({
          id: doc.id,
          name: doc.data().name,
          studentId: doc.data().studentId
        } as Student);
      });
      setStudents(studentList);

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

  const getAttendanceStatus = (studentId: string, date: Date): 'present' | 'late_present' | 'absent' | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${studentId}-${dateStr}`;
    const record = attendance.get(key);
    return record?.status || null;
  };

  const getMonthStats = (studentId: string) => {
    let present = 0;
    let late = 0;
    let absent = 0;
    daysInMonth.forEach(day => {
      const status = getAttendanceStatus(studentId, day);
      if (status === 'present') present++;
      if (status === 'late_present') late++;
      if (status === 'absent') absent++;
    });
    return { present, late, absent };
  };

  const getOverallStats = () => {
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    
    students.forEach(student => {
      const stats = getMonthStats(student.id);
      totalPresent += stats.present;
      totalLate += stats.late;
      totalAbsent += stats.absent;
    });

    return { totalPresent, totalLate, totalAbsent };
  };

  const markAbsentees = async () => {
    await showConfirm({
      title: 'Mark Absentees',
      message: 'This will mark all unscanned students as absent for today. This action cannot be undone.',
      onConfirm: async () => {
        setProcessingAbsent(true);
        
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
            studentId,
            date: todayStr,
            status: 'absent',
            timestamp: Date.now(),
            teacherUid: user.uid
          });
        }

        await fetchData();
        showToast('Absentees marked successfully', 'success');
        setProcessingAbsent(false);
      }
    });
  };
    

  const exportData = () => {
    const monthStr = format(currentMonth, 'MMMM yyyy');
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    let csv = `MC Attendance Box - Export (${monthStr})\n\n`;
    csv += `Student Name,Student ID,`;
    
    const days: string[] = [];
    daysInMonth.forEach(day => {
      days.push(format(day, 'yyyy-MM-dd'));
      csv += `${format(day, 'MMM d')},`;
    });
    csv += 'Total Present,Total Late,Total Absent\n';

    students.forEach(student => {
      const stats = getMonthStats(student.id);
      csv += `"${student.name}","${student.studentId}",`;
      
      days.forEach(dayStr => {
        const status = getAttendanceStatus(student.id, parseISO(dayStr));
        if (status === 'present') csv += 'P,';
        else if (status === 'late_present') csv += 'L,';
        else if (status === 'absent') csv += 'A,';
        else csv += '-,';
      });
      
      csv += `${stats.present},${stats.late},${stats.absent}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${year}_${month.toString().padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    const monthStr = format(currentMonth, 'MMMM yyyy');
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    
    let text = `MC Attendance Box - Export (${monthStr})\n\n`;
    text += `Student Name\tStudent ID\t`;
    
    const days: string[] = [];
    daysInMonth.forEach(day => {
      days.push(format(day, 'yyyy-MM-dd'));
      text += `${format(day, 'MMM d')}\t`;
    });
    text += 'Total Present\tTotal Late\tTotal Absent\n';

    students.forEach(student => {
      const stats = getMonthStats(student.id);
      text += `${student.name}\t${student.studentId}\t`;
      
      days.forEach(dayStr => {
        const status = getAttendanceStatus(student.id, parseISO(dayStr));
        if (status === 'present') text += 'P\t';
        else if (status === 'late_present') text += 'L\t';
        else if (status === 'absent') text += 'A\t';
        else text += '-\t';
      });
      
      text += `${stats.present}\t${stats.late}\t${stats.absent}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      showToast('Data copied! Paste into Google Sheets', 'success');
    }).catch(() => {
      showToast('Failed to copy data', 'error');
    });
  };

  const overallStats = getOverallStats();

  return (
    <div className="p-4 md:p-8 max-w-[1800px] mx-auto h-full flex flex-col">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Attendance Dashboard</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {format(currentMonth, 'MMMM yyyy')} · {students.length} students
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[120px] text-center px-2">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={exportData}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            title="Export CSV"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={copyToClipboard}
            className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            title="Copy for Sheets"
          >
            <Calendar className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Total Students</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{students.length}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Present</span>
          </div>
          <p className="text-2xl font-semibold text-green-600">{overallStats.totalPresent}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">Late</span>
          </div>
          <p className="text-2xl font-semibold text-amber-600">{overallStats.totalLate}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <UserMinus className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-gray-500">Absent</span>
          </div>
          <p className="text-2xl font-semibold text-red-600">{overallStats.totalAbsent}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-gray-600" />
            </div>
            <span className="text-sm text-gray-500">Attendance Rate</span>
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {overallStats.totalPresent + overallStats.totalLate + overallStats.totalAbsent > 0 
              ? Math.round(((overallStats.totalPresent + overallStats.totalLate) / (overallStats.totalPresent + overallStats.totalLate + overallStats.totalAbsent)) * 100)
              : 0}%
          </p>
        </div>
      </div>

      {format(new Date(), 'yyyy-MM') === format(currentMonth, 'yyyy-MM') && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-orange-900">Mark Today's Absentees</p>
              <p className="text-sm text-orange-700">
                {students.length > overallStats.totalPresent + overallStats.totalLate + overallStats.totalAbsent 
                  ? `${students.length - (overallStats.totalPresent + overallStats.totalLate + overallStats.totalAbsent)} students without logs` 
                  : 'All students have attendance records'}
              </p>
            </div>
          </div>
          <button
            onClick={markAbsentees}
            disabled={processingAbsent}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            {processingAbsent ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
            Mark Unscanned as Absent
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600 text-sm border-b bg-gray-50">Student</th>
                <th className="text-center p-3 font-medium text-gray-600 text-sm border-b bg-gray-50 w-20">Present</th>
                <th className="text-center p-3 font-medium text-gray-600 text-sm border-b bg-gray-50 w-20">Late</th>
                <th className="text-center p-3 font-medium text-gray-600 text-sm border-b bg-gray-50 w-20">Absent</th>
                {daysInMonth.map(day => (
                  <th key={day.toISOString()} className="text-center p-1.5 font-medium text-gray-500 text-xs border-b bg-gray-50 w-8">
                    <div className="hidden sm:block transform -rotate-45 origin-center">{format(day, 'd')}</div>
                    <div className="sm:hidden">{format(day, 'd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={daysInMonth.length + 4} className="p-8 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth.length + 4} className="p-8 text-center text-gray-500 text-sm">
                    No students registered. Register students to see attendance.
                  </td>
                </tr>
              ) : (
                students.map(student => {
                  const stats = getMonthStats(student.id);
                  return (
                    <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-gray-900 text-sm truncate max-w-[120px]">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.studentId}</p>
                        </div>
                      </td>
                      <td className="text-center p-3">
                        <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-sm">
                          {stats.present}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-sm">
                          {stats.late}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm">
                          {stats.absent}
                        </span>
                      </td>
                      {daysInMonth.map(day => {
                        const status = getAttendanceStatus(student.id, day);
                        const isToday = isSameDay(day, new Date());
                        return (
                          <td key={day.toISOString()} className="text-center p-1">
                            <div 
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium ${
                                status === 'present' 
                                  ? 'bg-green-100 text-green-700' 
                                  : status === 'late_present'
                                    ? 'bg-amber-100 text-amber-700'
                                    : status === 'absent' 
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-50 text-gray-300'
                              } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                              title={`${format(day, 'MMM d')}: ${status || 'No record'}`}
                            >
                              {status === 'present' ? 'P' : status === 'late_present' ? 'L' : status === 'absent' ? 'A' : ''}
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