import { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { Student } from '../types';
import { Users, Search, Edit2, Trash2, X, Loader2, Save, User, Phone, Mail, Calendar } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export default function Students() {
  const { user } = useContext(AuthContext);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, [user]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [search, students]);

  const fetchStudents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'students'), where('teacherUid', '==', user.uid));
      const snap = await getDocs(q);
      const list: Student[] = [];
      snap.forEach(doc => {
        list.push({
          id: doc.id,
          ...doc.data()
        } as Student);
      });
      setStudents(list);
      setFilteredStudents(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditStudent(student);
    setEditName(student.name);
    setEditStudentId(student.studentId);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editStudent) return;
    try {
      await updateDoc(doc(db, 'students', editStudent.id), {
        name: editName,
        studentId: editStudentId
      });
      setEditOpen(false);
      fetchStudents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (studentId: string) => {
    try {
      await deleteDoc(doc(db, 'students', studentId));
      setDeleteConfirm(null);
      fetchStudents();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-900/20">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight">Students</h2>
          <p className="text-gray-500 mt-0.5">View and manage student records</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-lg shadow-gray-100/50 border border-gray-100/50 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or student ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <User className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm">
                {search ? 'No students found matching your search' : 'No students registered yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredStudents.map(student => (
                <div key={student.id} className="p-4 md:p-5 hover:bg-gray-50/80 transition-all border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{student.name}</p>
                        <p className="text-sm text-gray-500">{student.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(student)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(student.id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 w-full max-w-md z-50 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">Edit Student</Dialog.Title>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                <input
                  type="text"
                  value={editStudentId}
                  onChange={(e) => setEditStudentId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Dialog.Close asChild>
                <button className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 w-full max-w-sm z-50 shadow-2xl">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">Delete Student</Dialog.Title>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this student? This action cannot be undone and all attendance records will be lost.</p>
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}