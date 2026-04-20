export interface Student {
  id: string; // Document ID
  name: string;
  studentId: string;
  faceDescriptor: number[];
  teacherUid: string;
  createdAt: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'late_present' | 'absent';
  timestamp: number;
  teacherUid: string;
}
