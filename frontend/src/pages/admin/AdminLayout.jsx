import RoleLayout from '../../components/RoleLayout'

const links = [
  { to: '/admin', text: 'Overview', icon: 'home', end: true },

  { to: '/admin/users', text: 'Users', icon: 'users', group: 'People' },
  { to: '/admin/import', text: 'Import', icon: 'import', group: 'People' },
  { to: '/admin/parent-links', text: 'Parents & children', icon: 'links', group: 'People' },
  { to: '/admin/enrollments', text: 'Enrollments', icon: 'enrollments', group: 'People' },

  { to: '/admin/subjects', text: 'Subjects', icon: 'subjects', group: 'Classes' },
  { to: '/admin/classes', text: 'Classes', icon: 'classes', group: 'Classes' },
  { to: '/admin/timetable', text: 'Timetable', icon: 'timetable', group: 'Classes' },
  { to: '/admin/checkin', text: 'Check-in', icon: 'checkin', group: 'Classes' },
  { to: '/admin/attendance', text: 'Attendance', icon: 'attendance', group: 'Classes' },

  { to: '/admin/materials', text: 'Materials', icon: 'materials', group: 'Learning' },
  { to: '/admin/assignments', text: 'Assignments', icon: 'assignments', group: 'Learning' },
  { to: '/admin/quizzes', text: 'Quizzes', icon: 'quizzes', group: 'Learning' },
  { to: '/admin/exams', text: 'Exams', icon: 'exams', group: 'Learning' },
  { to: '/admin/performance', text: 'Performance', icon: 'performance', group: 'Learning' },
  { to: '/admin/progress', text: 'Student progress', icon: 'progress', group: 'Learning' },
  { to: '/admin/certificates', text: 'Certificates', icon: 'certificates', group: 'Learning' },

  { to: '/admin/fees', text: 'Fees', icon: 'fees', group: 'Money' },
  { to: '/admin/payments', text: 'Payments', icon: 'payments', group: 'Money' },
  { to: '/admin/reports', text: 'Reports', icon: 'reports', group: 'Money' },

  { to: '/admin/announcements', text: 'Announcements', icon: 'announcements', group: 'Communication' },
  { to: '/admin/messages', text: 'Messages', icon: 'messages', group: 'Communication' },
  { to: '/admin/calendar', text: 'Calendar', icon: 'calendar', group: 'Communication' },
  { to: '/admin/email-log', text: 'Email log', icon: 'emaillog', group: 'Communication' },
]

export default function AdminLayout() {
  return <RoleLayout links={links} />
}
