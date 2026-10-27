import RoleLayout from './RoleLayout'

const teacherLinks = [
  { to: '/teacher', text: 'My classes', icon: 'home', end: true },

  { to: '/teacher/timetable', text: 'Timetable', icon: 'timetable', group: 'Classes' },
  { to: '/teacher/schedule', text: 'Manage schedule', icon: 'schedule', group: 'Classes' },
  { to: '/teacher/checkin', text: 'Check-in', icon: 'checkin', group: 'Classes' },
  { to: '/teacher/attendance', text: 'Attendance', icon: 'attendance', group: 'Classes' },

  { to: '/teacher/materials', text: 'Materials', icon: 'materials', group: 'Learning' },
  { to: '/teacher/assignments', text: 'Assignments', icon: 'assignments', group: 'Learning' },
  { to: '/teacher/quizzes', text: 'Quizzes', icon: 'quizzes', group: 'Learning' },
  { to: '/teacher/exams', text: 'Exams', icon: 'exams', group: 'Learning' },
  { to: '/teacher/performance', text: 'Performance', icon: 'performance', group: 'Learning' },
  { to: '/teacher/progress', text: 'Student progress', icon: 'progress', group: 'Learning' },
  { to: '/teacher/certificates', text: 'Certificates', icon: 'certificates', group: 'Learning' },

  { to: '/teacher/announcements', text: 'Announcements', icon: 'announcements', group: 'Communication' },
  { to: '/teacher/messages', text: 'Messages', icon: 'messages', group: 'Communication' },
  { to: '/teacher/calendar', text: 'Calendar', icon: 'calendar', group: 'Communication' },
]

const studentLinks = [
  { to: '/student', text: 'My classes', icon: 'home', end: true },

  { to: '/student/timetable', text: 'Timetable', icon: 'timetable', group: 'Learning' },
  { to: '/student/materials', text: 'Materials', icon: 'materials', group: 'Learning' },
  { to: '/student/assignments', text: 'Assignments', icon: 'assignments', group: 'Learning' },
  { to: '/student/quizzes', text: 'Quizzes', icon: 'quizzes', group: 'Learning' },
  { to: '/student/exams', text: 'Exams', icon: 'exams', group: 'Learning' },
  { to: '/student/grades', text: 'Grades', icon: 'grades', group: 'Learning' },
  { to: '/student/performance', text: 'Performance', icon: 'performance', group: 'Learning' },
  { to: '/student/certificates', text: 'Certificates', icon: 'certificates', group: 'Learning' },

  { to: '/student/attendance', text: 'Attendance', icon: 'attendance', group: 'Attendance' },
  { to: '/student/absence', text: 'Report absence', icon: 'absence', group: 'Attendance' },

  { to: '/student/fees', text: 'Fees', icon: 'fees', group: 'Money' },

  { to: '/student/announcements', text: 'Announcements', icon: 'announcements', group: 'Communication' },
  { to: '/student/messages', text: 'Messages', icon: 'messages', group: 'Communication' },
  { to: '/student/calendar', text: 'Calendar', icon: 'calendar', group: 'Communication' },
]

const parentLinks = [
  { to: '/parent', text: 'My children', icon: 'home', end: true },
  { to: '/parent/children', text: 'Add a child', icon: 'child' },

  { to: '/parent/attendance', text: 'Attendance', icon: 'attendance', group: 'Progress' },
  { to: '/parent/absence', text: 'Report absence', icon: 'absence', group: 'Progress' },
  { to: '/parent/exams', text: 'Exams', icon: 'exams', group: 'Progress' },
  { to: '/parent/grades', text: 'Grades', icon: 'grades', group: 'Progress' },
  { to: '/parent/performance', text: 'Performance', icon: 'performance', group: 'Progress' },
  { to: '/parent/timetable', text: 'Timetable', icon: 'timetable', group: 'Progress' },
  { to: '/parent/certificates', text: 'Certificates', icon: 'certificates', group: 'Progress' },

  { to: '/parent/fees', text: 'Fees', icon: 'fees', group: 'Money' },

  { to: '/parent/announcements', text: 'Announcements', icon: 'announcements', group: 'Communication' },
  { to: '/parent/messages', text: 'Messages', icon: 'messages', group: 'Communication' },
  { to: '/parent/calendar', text: 'Calendar', icon: 'calendar', group: 'Communication' },
]

export const TeacherLayout = () => <RoleLayout links={teacherLinks} />
export const StudentLayout = () => <RoleLayout links={studentLinks} />
export const ParentLayout = () => <RoleLayout links={parentLinks} />
