import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute, { homeFor } from './components/ProtectedRoute'
import { TeacherLayout, StudentLayout, ParentLayout } from './components/RoleLayouts'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/dashboards/AdminDashboard'
import Users from './pages/admin/Users'
import Subjects from './pages/admin/Subjects'
import Classes from './pages/admin/Classes'
import Enrollments from './pages/admin/Enrollments'
import ParentLinks from './pages/admin/ParentLinks'
import TeacherDashboard from './pages/dashboards/TeacherDashboard'
import StudentDashboard from './pages/dashboards/StudentDashboard'
import ParentDashboard from './pages/dashboards/ParentDashboard'
import TimetableView from './pages/shared/TimetableView'
import AttendanceSummary from './pages/shared/AttendanceSummary'
import ScheduleManager from './pages/shared/ScheduleManager'
import AttendanceMarking from './pages/shared/AttendanceMarking'
import MaterialsManager from './pages/shared/MaterialsManager'
import MaterialsList from './pages/shared/MaterialsList'
import AssignmentsManager from './pages/shared/AssignmentsManager'
import StudentAssignments from './pages/shared/StudentAssignments'
import GradesView from './pages/shared/GradesView'
import MyFees from './pages/shared/MyFees'
import Fees from './pages/admin/Fees'
import Payments from './pages/admin/Payments'
import Receipt from './pages/Receipt'
import Announcements from './pages/shared/Announcements'
import Notifications from './pages/shared/Notifications'
import QuizManager from './pages/shared/QuizManager'
import StudentQuizzes from './pages/shared/StudentQuizzes'
import PerformanceView from './pages/shared/PerformanceView'
import ClassPerformance from './pages/shared/ClassPerformance'
import Messages from './pages/shared/Messages'
import CalendarPage from './pages/shared/CalendarPage'
import CertificatesManager from './pages/shared/CertificatesManager'
import MyCertificates from './pages/shared/MyCertificates'
import Certificate from './pages/Certificate'
import Profile from './pages/shared/Profile'
import AbsenceNotice from './pages/shared/AbsenceNotice'
import ImportPage from './pages/admin/ImportPage'
import Reports from './pages/admin/Reports'
import EmailLog from './pages/admin/EmailLog'
import ExamsManager from './pages/shared/ExamsManager'
import ExamProgress from './pages/shared/ExamProgress'
import CheckInDesk from './pages/shared/CheckInDesk'
import MyChildren from './pages/shared/MyChildren'

function Home() {
  const { session, profile, loading } = useAuth()
  if (loading || (session && !profile)) return <div className="center-note">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(profile.role)} replace />
}

const guard = (role, el) => <ProtectedRoute allowedRoles={[role]}>{el}</ProtectedRoute>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/admin" element={guard('admin', <AdminLayout />)}>
        <Route index element={<AdminDashboard />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="exams" element={<ExamsManager />} />
        <Route path="progress" element={<ExamProgress />} />
        <Route path="profile" element={<Profile />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="email-log" element={<EmailLog />} />
        <Route path="messages" element={<Messages />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="certificates" element={<CertificatesManager />} />
        <Route path="users" element={<Users />} />
        <Route path="subjects" element={<Subjects />} />
        <Route path="classes" element={<Classes />} />
        <Route path="enrollments" element={<Enrollments />} />
        <Route path="parent-links" element={<ParentLinks />} />
        <Route path="timetable" element={<ScheduleManager />} />
        <Route path="attendance" element={<AttendanceMarking />} />
        <Route path="checkin" element={<CheckInDesk />} />
        <Route path="materials" element={<MaterialsManager />} />
        <Route path="assignments" element={<AssignmentsManager />} />
        <Route path="quizzes" element={<QuizManager />} />
        <Route path="performance" element={<ClassPerformance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="payments" element={<Payments />} />
      </Route>

      <Route path="/teacher" element={guard('teacher', <TeacherLayout />)}>
        <Route index element={<TeacherDashboard />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="exams" element={<ExamsManager />} />
        <Route path="progress" element={<ExamProgress />} />
        <Route path="profile" element={<Profile />} />
        <Route path="messages" element={<Messages />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="certificates" element={<CertificatesManager />} />
        <Route path="timetable" element={<TimetableView />} />
        <Route path="schedule" element={<ScheduleManager />} />
        <Route path="attendance" element={<AttendanceMarking />} />
        <Route path="checkin" element={<CheckInDesk />} />
        <Route path="materials" element={<MaterialsManager />} />
        <Route path="assignments" element={<AssignmentsManager />} />
        <Route path="quizzes" element={<QuizManager />} />
        <Route path="performance" element={<ClassPerformance />} />
      </Route>

      <Route path="/student" element={guard('student', <StudentLayout />)}>
        <Route index element={<StudentDashboard />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="exams" element={<ExamProgress />} />
        <Route path="profile" element={<Profile />} />
        <Route path="absence" element={<AbsenceNotice />} />
        <Route path="messages" element={<Messages />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="certificates" element={<MyCertificates />} />
        <Route path="timetable" element={<TimetableView />} />
        <Route path="attendance" element={<AttendanceSummary />} />
        <Route path="materials" element={<MaterialsList />} />
        <Route path="assignments" element={<StudentAssignments />} />
        <Route path="quizzes" element={<StudentQuizzes />} />
        <Route path="performance" element={<PerformanceView />} />
        <Route path="grades" element={<GradesView />} />
        <Route path="fees" element={<MyFees />} />
      </Route>

      <Route path="/parent" element={guard('parent', <ParentLayout />)}>
        <Route index element={<ParentDashboard />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="exams" element={<ExamProgress />} />
        <Route path="profile" element={<Profile />} />
        <Route path="absence" element={<AbsenceNotice />} />
        <Route path="children" element={<MyChildren />} />
        <Route path="messages" element={<Messages />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="certificates" element={<MyCertificates />} />
        <Route path="timetable" element={<TimetableView />} />
        <Route path="attendance" element={<AttendanceSummary />} />
        <Route path="grades" element={<GradesView />} />
        <Route path="performance" element={<PerformanceView />} />
        <Route path="fees" element={<MyFees />} />
      </Route>

      <Route path="/receipt/:id" element={<ProtectedRoute><Receipt /></ProtectedRoute>} />
      <Route path="/certificate/:id" element={<ProtectedRoute><Certificate /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
