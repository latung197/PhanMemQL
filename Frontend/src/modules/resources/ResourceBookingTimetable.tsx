import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  Car, 
  Laptop, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Briefcase, 
  FileText, 
  Printer, 
  Edit, 
  Trash2, 
  X, 
  CalendarDays, 
  Repeat, 
  Layers, 
  DoorClosed, 
  ShieldCheck, 
  Check, 
  AlertTriangle,
  ArrowRight,
  MapPin,
  Users,
  Settings,
  Flame,
  FolderKanban,
  Phone
} from 'lucide-react';
import { CompanyResource, ResourceBooking, CompanyResourceType, BookingStatus, RecurrenceFrequency } from '../../types/resourceBooking';
import { resourceBookingService } from '../../services/resourceBookingService';
import { Employee, UserProfile } from '../../types';
import { showToast } from '../../utils/toast';

interface ResourceBookingTimetableProps {
  currentUser?: UserProfile | null;
  employees?: Employee[];
}

type ViewMode = 'day' | 'week' | 'month' | 'list';

const RESOURCE_TYPES_CONFIG: { type: CompanyResourceType | 'all'; label: string; icon: any; color: string }[] = [
  { type: 'all', label: 'Tất Cả Tài Nguyên', icon: Layers, color: 'text-slate-600 dark:text-slate-300' },
  { type: 'meeting_room', label: 'Phòng Họp', icon: Building2, color: 'text-blue-600 dark:text-blue-400' },
  { type: 'vehicle', label: 'Xe Ô Tô Công Ty', icon: Car, color: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'computer', label: 'Máy Tính & IT', icon: Laptop, color: 'text-purple-600 dark:text-purple-400' },
  { type: 'special_equipment', label: 'Thiết Bị Khảo Sát & Khác', icon: Camera, color: 'text-amber-600 dark:text-amber-400' }
];

const COMMON_PROJECTS = [
  'Dự án Nâng Cấp Hệ Thống ERP Doanh Nghiệp Toàn Diện',
  'Dự án Mở Rộng Dây Chuyền Sản Xuất Tự Động Hóa 2026',
  'Dự án Trợ Lý Ảo Phân Tích Dữ Liệu Bán Hàng AI',
  'Dự án Cung Cấp Thiết Bị Mạng & Viễn Thông Công Nghiệp',
  'Chiến Dịch Tăng Trưởng Doanh Số Phân Hệ Khách Hàng Doanh Nghiệp',
  'Tuyển Dụng & Phát Triển Đội Ngũ Nhân Lực CNTT Chiến Lược',
  'Dự án Nâng Cấp Cơ Sở Hạ Tầng Cloud & Bảo Mật Mạng',
  'Hoạt Động Quản Trị & Vận Hành Doanh Nghiệp Nội Bộ'
];

export const ResourceBookingTimetable: React.FC<ResourceBookingTimetableProps> = ({
  currentUser,
  employees = []
}) => {
  // 1. Data state
  const [resources, setResources] = useState<CompanyResource[]>(() => resourceBookingService.getResources());
  const [bookings, setBookings] = useState<ResourceBooking[]>(() => resourceBookingService.getBookings());

  // 2. Navigation & View state
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedResourceType, setSelectedResourceType] = useState<CompanyResourceType | 'all'>('all');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');

  // 3. Modals state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResourceMgrModal, setShowResourceMgrModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ResourceBooking | null>(null);

  // Form state for Booking
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    resourceId: string;
    title: string;
    projectName: string;
    registrantId: string;
    registrantName: string;
    registrantCode: string;
    department: string;
    registrantPhone: string;
    registrantEmail: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    attendeeCount: number;
    recurrenceFrequency: RecurrenceFrequency;
    recurrenceInterval: number;
    recurrenceDays: number[];
    recurrenceEndCondition: 'never' | 'count' | 'until_date';
    recurrenceEndCount: number;
    recurrenceUntilDate: string;
    notes: string;
    needDriver: boolean;
    specialRequests: string[];
    status: BookingStatus;
  }>({
    resourceId: resources[0]?.id || '',
    title: '',
    projectName: COMMON_PROJECTS[0],
    registrantId: currentUser?.username || 'NV001',
    registrantName: currentUser?.fullName || 'Trần Thịnh',
    registrantCode: currentUser?.username || 'NV001',
    department: currentUser?.department || 'Ban Giám Đốc',
    registrantPhone: currentUser?.phone || '0901112233',
    registrantEmail: currentUser?.email || 'admin@erp-enterprise.vn',
    startDate: new Date().toISOString().slice(0, 10),
    startTime: '08:30',
    endDate: new Date().toISOString().slice(0, 10),
    endTime: '10:30',
    attendeeCount: 4,
    recurrenceFrequency: 'none',
    recurrenceInterval: 1,
    recurrenceDays: [1],
    recurrenceEndCondition: 'never',
    recurrenceEndCount: 5,
    recurrenceUntilDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: '',
    needDriver: false,
    specialRequests: [],
    status: 'confirmed'
  });

  // Conflict warning state in Modal
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter(r => {
      if (selectedResourceType !== 'all' && r.type !== selectedResourceType) return false;
      return true;
    });
  }, [resources, selectedResourceType]);

  // Check conflicts in real time whenever form dates/times or resource changes
  useEffect(() => {
    if (!showBookingModal || !formData.resourceId) {
      setConflictWarning(null);
      return;
    }

    const conflict = resourceBookingService.checkConflict(
      formData.resourceId,
      formData.startDate,
      formData.startTime,
      formData.endDate,
      formData.endTime,
      editingBookingId || undefined
    );

    if (conflict.hasConflict && conflict.conflictingBooking) {
      setConflictWarning(
        `Trùng lịch! Tài nguyên đã được đặt từ ${conflict.conflictingBooking.startTime} - ${conflict.conflictingBooking.endTime} bởi ${conflict.conflictingBooking.registrantName} (Dự án: ${conflict.conflictingBooking.projectName}).`
      );
    } else {
      setConflictWarning(null);
    }
  }, [
    showBookingModal,
    formData.resourceId,
    formData.startDate,
    formData.startTime,
    formData.endDate,
    formData.endTime,
    editingBookingId
  ]);

  // Helpers for Date calculations
  const formatDateString = (d: Date): string => {
    return d.toISOString().slice(0, 10);
  };

  const getDayNameVi = (d: Date): string => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[d.getDay()];
  };

  const currentDateStr = formatDateString(currentDate);

  // Quick navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open booking modal with prefilled data
  const handleOpenNewBooking = (prefill?: Partial<typeof formData>) => {
    setEditingBookingId(null);
    const defaultEmp = employees[0] || {
      id: currentUser?.username || 'NV001',
      name: currentUser?.fullName || 'Trần Thịnh',
      department: currentUser?.department || 'Ban Giám Đốc',
      phone: currentUser?.phone || '0901112233',
      email: currentUser?.email || 'admin@erp-enterprise.vn'
    };

    setFormData({
      resourceId: prefill?.resourceId || filteredResources[0]?.id || resources[0]?.id || '',
      title: prefill?.title || '',
      projectName: prefill?.projectName || COMMON_PROJECTS[0],
      registrantId: prefill?.registrantId || defaultEmp.id,
      registrantName: prefill?.registrantName || defaultEmp.name,
      registrantCode: prefill?.registrantCode || defaultEmp.id,
      department: prefill?.department || defaultEmp.department,
      registrantPhone: prefill?.registrantPhone || defaultEmp.phone || '',
      registrantEmail: prefill?.registrantEmail || defaultEmp.email || '',
      startDate: prefill?.startDate || currentDateStr,
      startTime: prefill?.startTime || '08:30',
      endDate: prefill?.endDate || currentDateStr,
      endTime: prefill?.endTime || '10:30',
      attendeeCount: prefill?.attendeeCount || 4,
      recurrenceFrequency: prefill?.recurrenceFrequency || 'none',
      recurrenceInterval: 1,
      recurrenceDays: [1],
      recurrenceEndCondition: 'never',
      recurrenceEndCount: 5,
      recurrenceUntilDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: prefill?.notes || '',
      needDriver: prefill?.needDriver || false,
      specialRequests: prefill?.specialRequests || [],
      status: 'confirmed'
    });
    setShowBookingModal(true);
  };

  // Open edit modal
  const handleEditBooking = (b: ResourceBooking) => {
    setEditingBookingId(b.id);
    setFormData({
      resourceId: b.resourceId,
      title: b.title,
      projectName: b.projectName,
      registrantId: b.registrantId,
      registrantName: b.registrantName,
      registrantCode: b.registrantCode,
      department: b.department,
      registrantPhone: b.registrantPhone || '',
      registrantEmail: b.registrantEmail || '',
      startDate: b.startDate,
      startTime: b.startTime,
      endDate: b.endDate,
      endTime: b.endTime,
      attendeeCount: b.attendeeCount || 1,
      recurrenceFrequency: b.recurrence.frequency,
      recurrenceInterval: b.recurrence.interval || 1,
      recurrenceDays: b.recurrence.daysOfWeek || [1],
      recurrenceEndCondition: b.recurrence.endCondition,
      recurrenceEndCount: b.recurrence.endCount || 5,
      recurrenceUntilDate: b.recurrence.untilDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes: b.notes || '',
      needDriver: b.needDriver || false,
      specialRequests: b.specialRequests || [],
      status: b.status
    });
    setShowDetailModal(false);
    setShowBookingModal(true);
  };

  // Submit booking form
  const handleSaveBooking = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast.error('Vui lòng nhập mục đích / nội dung đăng ký sử dụng tài nguyên!');
      return;
    }

    if (!formData.resourceId) {
      showToast.error('Vui lòng chọn tài nguyên cần sử dụng!');
      return;
    }

    if (formData.startTime >= formData.endTime && formData.startDate === formData.endDate) {
      showToast.error('Giờ kết thúc phải lớn hơn giờ bắt đầu!');
      return;
    }

    const selectedRes = resources.find(r => r.id === formData.resourceId);
    if (!selectedRes) {
      showToast.error('Không tìm thấy tài nguyên hợp lệ!');
      return;
    }

    const newBooking: ResourceBooking = {
      id: editingBookingId || `BK_${Date.now()}`,
      bookingCode: editingBookingId 
        ? (bookings.find(b => b.id === editingBookingId)?.bookingCode || resourceBookingService.generateBookingCode())
        : resourceBookingService.generateBookingCode(),
      title: formData.title.trim(),
      resourceId: selectedRes.id,
      resourceName: selectedRes.name,
      resourceCode: selectedRes.code,
      resourceType: selectedRes.type,
      resourceLocation: selectedRes.location,
      startDate: formData.startDate,
      startTime: formData.startTime,
      endDate: formData.endDate,
      endTime: formData.endTime,
      registrantId: formData.registrantId,
      registrantName: formData.registrantName,
      registrantCode: formData.registrantCode,
      department: formData.department,
      registrantPhone: formData.registrantPhone,
      registrantEmail: formData.registrantEmail,
      projectName: formData.projectName,
      attendeeCount: formData.attendeeCount,
      recurrence: {
        frequency: formData.recurrenceFrequency,
        interval: formData.recurrenceInterval,
        daysOfWeek: formData.recurrenceDays,
        endCondition: formData.recurrenceEndCondition,
        endCount: formData.recurrenceEndCount,
        untilDate: formData.recurrenceUntilDate
      },
      status: formData.status,
      notes: formData.notes,
      needDriver: formData.needDriver,
      specialRequests: formData.specialRequests,
      createdAt: new Date().toISOString()
    };

    const result = resourceBookingService.upsertBooking(newBooking);
    if (!result.success) {
      showToast.error(result.message);
      return;
    }

    setBookings(result.bookings);
    setShowBookingModal(false);
    showToast.success(result.message);
  };

  // Delete booking
  const handleDeleteBooking = (id: string) => {
    const updated = resourceBookingService.deleteBooking(id);
    setBookings(updated);
    setShowDetailModal(false);
    showToast.success('Đã xóa phiếu đăng ký sử dụng tài nguyên!');
  };

  // Update status directly
  const handleUpdateStatus = (id: string, status: BookingStatus) => {
    const updated = resourceBookingService.updateBookingStatus(id, status);
    setBookings(updated);
    if (selectedBooking && selectedBooking.id === id) {
      setSelectedBooking({ ...selectedBooking, status });
    }
    showToast.success(`Đã chuyển trạng thái phiếu sang "${getStatusBadge(status).text}"`);
  };

  // Helper for status badge
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return { text: 'Đã xác nhận', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' };
      case 'in_use':
        return { text: 'Đang sử dụng', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800 animate-pulse' };
      case 'pending':
        return { text: 'Chờ phê duyệt', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800' };
      case 'completed':
        return { text: 'Đã hoàn tất / Đã trả', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' };
      case 'cancelled':
        return { text: 'Đã hủy', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800' };
    }
  };

  // Helper for recurrence label
  const getRecurrenceLabel = (rec: ResourceBooking['recurrence']) => {
    switch (rec.frequency) {
      case 'daily': return 'Lặp lại hàng ngày';
      case 'weekly': return 'Lặp lại hàng tuần';
      case 'monthly': return 'Lặp lại hàng tháng';
      case 'yearly': return 'Lặp lại hàng năm';
      default: return 'Không lặp lại';
    }
  };

  // Helper for Resource Icon
  const getResourceIcon = (type: CompanyResourceType) => {
    switch (type) {
      case 'meeting_room': return Building2;
      case 'vehicle': return Car;
      case 'computer': return Laptop;
      case 'special_equipment': return Camera;
      default: return Layers;
    }
  };

  // Helper to check if a booking occurs on a given date (supporting recurrence logic)
  const isBookingOnDate = (b: ResourceBooking, targetDateStr: string): boolean => {
    if (b.status === 'cancelled') return false;

    // Direct match
    if (b.startDate === targetDateStr) return true;

    // Multi-day booking span
    if (b.startDate <= targetDateStr && b.endDate >= targetDateStr) return true;

    // Recurrence evaluation
    if (b.recurrence.frequency === 'none') return false;

    const bDate = new Date(b.startDate);
    const tDate = new Date(targetDateStr);
    if (tDate < bDate) return false;

    // Check end condition
    if (b.recurrence.endCondition === 'until_date' && b.recurrence.untilDate && targetDateStr > b.recurrence.untilDate) {
      return false;
    }

    if (b.recurrence.frequency === 'daily') {
      const interval = b.recurrence.interval || 1;
      const diffDays = Math.floor((tDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
      if (b.recurrence.endCondition === 'count' && b.recurrence.endCount && Math.floor(diffDays / interval) >= b.recurrence.endCount) {
        return false;
      }
      return diffDays % interval === 0;
    }

    if (b.recurrence.frequency === 'weekly') {
      const dayOfWeek = tDate.getDay() === 0 ? 7 : tDate.getDay(); // 1 to 7
      const targetDays = b.recurrence.daysOfWeek || [bDate.getDay() === 0 ? 7 : bDate.getDay()];
      if (!targetDays.includes(dayOfWeek)) return false;

      const diffWeeks = Math.floor((tDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      const interval = b.recurrence.interval || 1;
      if (b.recurrence.endCondition === 'count' && b.recurrence.endCount && diffWeeks >= b.recurrence.endCount) {
        return false;
      }
      return diffWeeks % interval === 0;
    }

    if (b.recurrence.frequency === 'monthly') {
      if (tDate.getDate() !== bDate.getDate()) return false;
      const diffMonths = (tDate.getFullYear() - bDate.getFullYear()) * 12 + (tDate.getMonth() - bDate.getMonth());
      const interval = b.recurrence.interval || 1;
      if (b.recurrence.endCondition === 'count' && b.recurrence.endCount && diffMonths >= b.recurrence.endCount) {
        return false;
      }
      return diffMonths % interval === 0;
    }

    if (b.recurrence.frequency === 'yearly') {
      return tDate.getDate() === bDate.getDate() && tDate.getMonth() === bDate.getMonth();
    }

    return false;
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBookings = bookings.filter(b => isBookingOnDate(b, todayStr));
    const inUseBookings = bookings.filter(b => b.status === 'in_use');
    const recurringBookings = bookings.filter(b => b.recurrence.frequency !== 'none' && b.status !== 'cancelled');

    return {
      totalResources: resources.length,
      availableResources: resources.filter(r => r.status === 'available').length,
      todayCount: todayBookings.length,
      inUseCount: inUseBookings.length,
      recurringCount: recurringBookings.length
    };
  }, [resources, bookings]);

  // Hourly slots for Day View (from 07:00 to 20:00)
  const timeHours = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  // Week days calculation
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(curr.setDate(diff));

    const days: { date: Date; dateStr: string; label: string; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const str = formatDateString(d);
      days.push({
        date: d,
        dateStr: str,
        label: `${getDayNameVi(d)} (${d.getDate()}/${d.getMonth() + 1})`,
        isToday: str === todayStr
      });
    }
    return days;
  }, [currentDate]);

  // Month days calculation (Calendar Matrix)
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const days: { date: Date; dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    // Padding for starting day (Monday based)
    let startDayOfWeek = firstDayOfMonth.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Sunday is 7

    for (let i = startDayOfWeek - 1; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      const str = formatDateString(prevDate);
      days.push({
        date: prevDate,
        dateStr: str,
        dayNumber: prevDate.getDate(),
        isCurrentMonth: false,
        isToday: str === todayStr
      });
    }

    // Days in current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const curr = new Date(year, month, i);
      const str = formatDateString(curr);
      days.push({
        date: curr,
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: str === todayStr
      });
    }

    // Trailing days to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const str = formatDateString(nextDate);
      days.push({
        date: nextDate,
        dateStr: str,
        dayNumber: nextDate.getDate(),
        isCurrentMonth: false,
        isToday: str === todayStr
      });
    }

    return days;
  }, [currentDate]);

  // Formatted header date range title
  const viewTitle = useMemo(() => {
    const d = currentDate;
    if (viewMode === 'day') {
      return `${getDayNameVi(d)}, Ngày ${d.getDate()} Tháng ${d.getMonth() + 1}, Năm ${d.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      return `Tuần từ ${first.date.getDate()}/${first.date.getMonth() + 1} đến ${last.date.getDate()}/${last.date.getMonth() + 1}/${last.date.getFullYear()}`;
    }
    if (viewMode === 'month') {
      return `Tháng ${d.getMonth() + 1} Năm ${d.getFullYear()}`;
    }
    return `Toàn Bộ Danh Sách Đăng Ký (${bookings.length} Phiếu)`;
  }, [viewMode, currentDate, weekDays, bookings.length]);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar & Quick Stats */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Top Title & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-600 text-white rounded-lg">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Đăng Ký & Thời Khóa Biểu Tài Nguyên
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                  Chuẩn ERP
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Thời khóa biểu đặt phòng họp, máy tính trạm, xe ô tô công tác & thiết bị chuyên dụng công ty.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowResourceMgrModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition border border-slate-200 dark:border-slate-700"
            >
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              <span>Quản Lý Tài Nguyên ({resources.length})</span>
            </button>

            <button
              onClick={() => handleOpenNewBooking()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-[5px] transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Đăng Ký Tài Nguyên Mới</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-150 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Tổng tài nguyên</p>
              <p className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">
                {metrics.totalResources} <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">({metrics.availableResources} sẵn sàng)</span>
              </p>
            </div>
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 rounded-lg">
              <Building2 className="h-4 w-4" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Lịch đặt hôm nay</p>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {metrics.todayCount} <span className="text-xs font-normal text-slate-400">lượt</span>
              </p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Đang sử dụng thực tế</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {metrics.inUseCount} <span className="text-xs font-normal text-slate-400">tài nguyên</span>
              </p>
            </div>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-lg">
              <Flame className="h-4 w-4" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Lịch định kỳ lặp lại</p>
              <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                {metrics.recurringCount} <span className="text-xs font-normal text-slate-400">chu kỳ</span>
              </p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-600 rounded-lg">
              <Repeat className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* View Mode Switcher, Date Controls, and Resource Category Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
          {/* Resource Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {RESOURCE_TYPES_CONFIG.map(tab => {
              const Icon = tab.icon;
              const isActive = selectedResourceType === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => setSelectedResourceType(tab.type)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap border ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Date Navigator & View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Buttons */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === 'day' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Theo Ngày
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === 'week' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Theo Tuần
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === 'month' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Theo Tháng
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Danh Sách
              </button>
            </div>

            {/* Date Navigator */}
            {viewMode !== 'list' && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={handlePrev}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition"
                  title="Trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Hôm nay
                </button>
                <button
                  onClick={handleNext}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition"
                  title="Sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 px-2 border-l border-slate-200 dark:border-slate-700">
                  {viewTitle}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Content View Router */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[580px]">
        {/* VIEW 1: DAY TIMETABLE (Theo Ngày - Ma trận giờ theo tài nguyên) */}
        {viewMode === 'day' && (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header row: Resources columns */}
              <div className="grid grid-cols-[100px_repeat(auto-fill,minmax(200px,1fr))] border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10"
                   style={{ gridTemplateColumns: `100px repeat(${filteredResources.length}, minmax(220px, 1fr))` }}>
                <div className="p-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center border-r border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  Khung Giờ
                </div>
                {filteredResources.map(res => {
                  const ResIcon = getResourceIcon(res.type);
                  return (
                    <div 
                      key={res.id} 
                      className="p-3 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg text-white text-xs" style={{ backgroundColor: res.color }}>
                          <ResIcon className="h-4 w-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate" title={res.name}>
                            {res.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            {res.code} • {res.capacity}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 truncate max-w-[130px]" title={res.location}>
                          📍 {res.location}
                        </span>
                        <button
                          onClick={() => handleOpenNewBooking({ resourceId: res.id, startDate: currentDateStr, endDate: currentDateStr })}
                          className="px-2 py-0.5 font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 transition"
                          title="Đặt tài nguyên này"
                        >
                          + Đặt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Slots Rows */}
              <div className="divide-y divide-slate-150 dark:divide-slate-800">
                {timeHours.map(hour => {
                  return (
                    <div 
                      key={hour} 
                      className="grid grid-cols-[100px_repeat(auto-fill,minmax(200px,1fr))] min-h-[64px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition group"
                      style={{ gridTemplateColumns: `100px repeat(${filteredResources.length}, minmax(220px, 1fr))` }}
                    >
                      {/* Hour Column */}
                      <div className="p-2 border-r border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 text-center flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/30">
                        {hour}
                      </div>

                      {/* Resource Slots */}
                      {filteredResources.map(res => {
                        // Find bookings for this resource in this day and this hour
                        const currentHourNum = parseInt(hour.split(':')[0], 10);
                        const slotBookings = bookings.filter(b => {
                          if (b.resourceId !== res.id) return false;
                          if (!isBookingOnDate(b, currentDateStr)) return false;

                          const startH = parseInt(b.startTime.split(':')[0], 10);
                          const endH = parseInt(b.endTime.split(':')[0], 10);
                          // Starts in this hour slot
                          return startH === currentHourNum;
                        });

                        return (
                          <div 
                            key={res.id} 
                            className="p-1 border-r border-slate-200 dark:border-slate-800 relative min-h-[64px] flex flex-col gap-1"
                          >
                            {slotBookings.map(b => {
                              const badge = getStatusBadge(b.status);
                              return (
                                <div
                                  key={b.id}
                                  onClick={() => {
                                    setSelectedBooking(b);
                                    setShowDetailModal(true);
                                  }}
                                  className="p-2 rounded-xl text-left shadow-sm cursor-pointer hover:shadow-md transition active:scale-[0.98] border text-xs"
                                  style={{
                                    backgroundColor: `${res.color}15`,
                                    borderColor: res.color
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                                      ⏰ {b.startTime} - {b.endTime}
                                    </span>
                                    {b.recurrence.frequency !== 'none' && (
                                      <span className="p-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-[10px]" title={getRecurrenceLabel(b.recurrence)}>
                                        <Repeat className="h-3 w-3" />
                                      </span>
                                    )}
                                  </div>

                                  <p className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1" title={b.title}>
                                    {b.title}
                                  </p>

                                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1 truncate max-w-[110px]" title={b.registrantName}>
                                      <User className="h-3 w-3 text-slate-400" />
                                      {b.registrantName}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded-full border text-[9px] font-semibold ${badge.bg}`}>
                                      {badge.text}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 truncate font-medium">
                                    📁 {b.projectName}
                                  </p>
                                </div>
                              );
                            })}

                            {slotBookings.length === 0 && (
                              <button
                                onClick={() => handleOpenNewBooking({ 
                                  resourceId: res.id, 
                                  startDate: currentDateStr, 
                                  endDate: currentDateStr,
                                  startTime: hour,
                                  endTime: `${String(currentHourNum + 1).padStart(2, '0')}:00`
                                })}
                                className="w-full h-full opacity-0 hover:opacity-100 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 transition flex items-center justify-center gap-1"
                              >
                                <Plus className="h-3.5 w-3.5" /> Đặt giờ này
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: WEEK TIMETABLE (Theo Tuần - 7 Ngày Trong Tuần) */}
        {viewMode === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[950px]">
              {/* Header 7 Days */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                {weekDays.map(day => (
                  <div 
                    key={day.dateStr} 
                    className={`p-3 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${
                      day.isToday ? 'bg-indigo-50/80 dark:bg-indigo-950/60 font-black' : ''
                    }`}
                  >
                    <p className={`text-xs uppercase font-extrabold ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {day.label}
                    </p>
                    {day.isToday && (
                      <span className="inline-block mt-0.5 px-2 py-0.2 text-[9px] font-bold bg-indigo-600 text-white rounded-full">
                        Hôm Nay
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 7 Columns of Days */}
              <div className="grid grid-cols-7 divide-x divide-slate-150 dark:divide-slate-800 min-h-[500px]">
                {weekDays.map(day => {
                  // Filter bookings on this day and matching resource type
                  const dayBookings = bookings.filter(b => {
                    if (selectedResourceType !== 'all' && b.resourceType !== selectedResourceType) return false;
                    return isBookingOnDate(b, day.dateStr);
                  }).sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div 
                      key={day.dateStr} 
                      className={`p-2 flex flex-col gap-2 ${day.isToday ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}
                    >
                      <button
                        onClick={() => handleOpenNewBooking({ startDate: day.dateStr, endDate: day.dateStr })}
                        className="w-full py-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Đặt lịch
                      </button>

                      {dayBookings.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center p-4 text-center">
                          <p className="text-[11px] text-slate-400 dark:text-slate-600 italic">Trống lịch</p>
                        </div>
                      ) : (
                        dayBookings.map(b => {
                          const res = resources.find(r => r.id === b.resourceId);
                          const ResIcon = getResourceIcon(b.resourceType);
                          const badge = getStatusBadge(b.status);

                          return (
                            <div
                              key={b.id}
                              onClick={() => {
                                setSelectedBooking(b);
                                setShowDetailModal(true);
                              }}
                              className="p-2.5 rounded-xl border bg-white dark:bg-slate-800/90 shadow-sm hover:shadow-md transition cursor-pointer text-xs space-y-1.5"
                              style={{ borderLeftColor: res?.color || '#6366f1', borderLeftWidth: '4px' }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono font-bold text-[11px] text-indigo-700 dark:text-indigo-400">
                                  {b.startTime} - {b.endTime}
                                </span>
                                {b.recurrence.frequency !== 'none' && (
                                  <span title={getRecurrenceLabel(b.recurrence)}><Repeat className="h-3 w-3 text-brand-600" /></span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold line-clamp-1">
                                <ResIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                <span className="truncate" title={b.resourceName}>{b.resourceName}</span>
                              </div>

                              <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                                {b.title}
                              </p>

                              <div className="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[10px] text-slate-500">
                                <span className="truncate max-w-[90px]" title={b.registrantName}>
                                  👤 {b.registrantName}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded-full border text-[8px] font-bold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                              </div>

                              <p className="text-[9px] text-indigo-600 dark:text-indigo-400 truncate">
                                📁 {b.projectName}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: MONTH TIMETABLE (Theo Tháng - Lịch Tháng Tổng Quan) */}
        {viewMode === 'month' && (
          <div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase py-2">
              <div>Thứ Hai</div>
              <div>Thứ Ba</div>
              <div>Thứ Tư</div>
              <div>Thứ Năm</div>
              <div>Thứ Sáu</div>
              <div>Thứ Bảy</div>
              <div>Chủ Nhật</div>
            </div>

            {/* Matrix of days */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-150 dark:divide-slate-800">
              {monthDays.map(day => {
                const dayBookings = bookings.filter(b => {
                  if (selectedResourceType !== 'all' && b.resourceType !== selectedResourceType) return false;
                  return isBookingOnDate(b, day.dateStr);
                });

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setCurrentDate(day.date);
                      setViewMode('day');
                    }}
                    className={`min-h-[110px] p-2 transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 relative flex flex-col justify-between ${
                      !day.isCurrentMonth ? 'opacity-40 bg-slate-50/50 dark:bg-slate-900/50' : ''
                    } ${day.isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg ${
                        day.isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {day.dayNumber}
                      </span>
                      {dayBookings.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          {dayBookings.length} lịch
                        </span>
                      )}
                    </div>

                    <div className="my-1 space-y-1 overflow-hidden">
                      {dayBookings.slice(0, 2).map(b => {
                        const res = resources.find(r => r.id === b.resourceId);
                        return (
                          <div
                            key={b.id}
                            className="px-1.5 py-0.5 rounded text-[10px] truncate font-medium text-white flex items-center gap-1 shadow-xs"
                            style={{ backgroundColor: res?.color || '#4f46e5' }}
                            title={`${b.startTime} - ${b.resourceName}: ${b.title}`}
                          >
                            <span className="font-mono text-[9px]">{b.startTime}</span>
                            <span className="truncate">{b.resourceName}</span>
                          </div>
                        );
                      })}
                      {dayBookings.length > 2 && (
                        <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold text-center">
                          +{dayBookings.length - 2} lịch khác...
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 opacity-0 hover:opacity-100">
                        Bấm xem ngày ➜
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 4: LIST TABLE VIEW (Danh Sách Dạng Bảng ERP) */}
        {viewMode === 'list' && (
          <div className="p-4 space-y-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo nội dung, tài nguyên, người đăng ký, dự án..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lọc trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="in_use">Đang sử dụng</option>
                  <option value="pending">Chờ phê duyệt</option>
                  <option value="completed">Đã hoàn tất / Đã trả</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Mã Phiếu</th>
                    <th className="p-3">Tài Nguyên</th>
                    <th className="p-3">Nội Dung / Mục Đích</th>
                    <th className="p-3">Thời Gian Sử Dụng</th>
                    <th className="p-3">Người Đăng Ký</th>
                    <th className="p-3">Dự Án</th>
                    <th className="p-3">Lặp Lại</th>
                    <th className="p-3">Trạng Thái</th>
                    <th className="p-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                  {bookings
                    .filter(b => {
                      if (selectedResourceType !== 'all' && b.resourceType !== selectedResourceType) return false;
                      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase();
                        return (
                          b.title.toLowerCase().includes(q) ||
                          b.resourceName.toLowerCase().includes(q) ||
                          b.registrantName.toLowerCase().includes(q) ||
                          b.projectName.toLowerCase().includes(q) ||
                          b.bookingCode.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map(b => {
                      const ResIcon = getResourceIcon(b.resourceType);
                      const badge = getStatusBadge(b.status);

                      return (
                        <tr 
                          key={b.id} 
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition cursor-pointer"
                          onClick={() => {
                            setSelectedBooking(b);
                            setShowDetailModal(true);
                          }}
                        >
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {b.bookingCode}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <ResIcon className="h-4 w-4 text-slate-400" />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100">{b.resourceName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{b.resourceCode}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{b.title}</p>
                            {b.notes && <p className="text-[10px] text-slate-400 line-clamp-1 italic">{b.notes}</p>}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                              {b.startDate}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {b.startTime} - {b.endTime}
                            </p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{b.registrantName}</p>
                            <p className="text-[10px] text-slate-400">{b.department}</p>
                          </td>
                          <td className="p-3 max-w-[180px]">
                            <p className="text-slate-700 dark:text-slate-300 font-medium truncate" title={b.projectName}>
                              {b.projectName}
                            </p>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                              {b.recurrence.frequency !== 'none' && <Repeat className="h-3 w-3" />}
                              {getRecurrenceLabel(b.recurrence)}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}`}>
                              {badge.text}
                            </span>
                          </td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditBooking(b)}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition"
                                title="Sửa phiếu"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedBooking(b);
                                  setShowPrintModal(true);
                                }}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition"
                                title="In phiếu"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(b.id)}
                                className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 rounded-lg transition"
                                title="Xóa phiếu"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. MODAL: ĐĂNG KÝ MỚI / SỬA LỊCH SỬ DỤNG TÀI NGUYÊN */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {editingBookingId ? 'Cập Nhật Phiếu Đăng Ký Tài Nguyên' : 'Đăng Ký Sử Dụng Tài Nguyên Mới'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lên lịch thời khóa biểu phòng họp, xe ô tô, máy tính theo ngày, tuần, tháng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBookingModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveBooking} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Conflict warning banner if overlapping */}
              {conflictWarning && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">Cảnh Báo Xung Đột Lịch Đăng Ký:</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{conflictWarning}</p>
                  </div>
                </div>
              )}

              {/* 1. Chọn Tài Nguyên */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Tài Nguyên Công Ty Cần Đăng Ký <strong className="text-rose-500">*</strong></span>
                  <span className="text-[11px] font-normal text-slate-400">Phòng họp, Xe, Máy tính, Thiết bị</span>
                </label>
                <select
                  value={formData.resourceId}
                  onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {resources.map(r => (
                    <option key={r.id} value={r.id}>
                      [{r.code}] {r.name} - ({r.capacity} | {r.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Tiêu đề / Mục đích sử dụng */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Mục Đích / Nội Dung Sử Dụng <strong className="text-rose-500">*</strong>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ví dụ: Họp Sprint Review quý IV, Đưa đón chuyên gia khảo sát Bình Dương, Render AI..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* 3. Dự Án & Người Đăng Ký */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Dự Án Đăng Ký <strong className="text-rose-500">*</strong>
                  </label>
                  <input
                    type="text"
                    list="projects-list"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="Chọn hoặc nhập tên dự án..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <datalist id="projects-list">
                    {COMMON_PROJECTS.map(p => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Người Đăng Ký Sử Dụng <strong className="text-rose-500">*</strong>
                  </label>
                  <select
                    value={formData.registrantId}
                    onChange={(e) => {
                      const emp = employees.find(em => em.id === e.target.value);
                      if (emp) {
                        setFormData({
                          ...formData,
                          registrantId: emp.id,
                          registrantName: emp.name,
                          registrantCode: emp.id,
                          department: emp.department,
                          registrantPhone: emp.phone || '',
                          registrantEmail: emp.email || ''
                        });
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id} - {emp.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Khung Giờ & Ngày Tháng */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Thời Gian Sử Dụng (Ngày & Giờ)
                  </span>
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, startTime: '08:00', endTime: '12:00' })}
                      className="px-2 py-0.5 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded border border-slate-200 dark:border-slate-600 font-semibold"
                    >
                      Sáng (8h-12h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, startTime: '13:30', endTime: '17:30' })}
                      className="px-2 py-0.5 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded border border-slate-200 dark:border-slate-600 font-semibold"
                    >
                      Chiều (13h30-17h30)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, startTime: '08:00', endTime: '17:30' })}
                      className="px-2 py-0.5 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded border border-slate-200 dark:border-slate-600 font-semibold"
                    >
                      Cả ngày
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Giờ bắt đầu</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Ngày kết thúc</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Giờ kết thúc</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 5. CẤU HÌNH LẶP LẠI (RECURRENCE SELECTOR) - THEO YÊU CẦU CỦA USER */}
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-extrabold text-purple-900 dark:text-purple-200">
                    Tùy Chọn Lặp Lại Định Kỳ (Recurrence)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'none', label: 'Không lặp lại' },
                    { id: 'daily', label: 'Hàng ngày' },
                    { id: 'weekly', label: 'Hàng tuần' },
                    { id: 'monthly', label: 'Hàng tháng' },
                    { id: 'yearly', label: 'Hàng năm' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, recurrenceFrequency: item.id as any })}
                      className={`p-2 rounded-xl text-center font-bold transition border text-xs ${
                        formData.recurrenceFrequency === item.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Additional controls if recurrence is selected */}
                {formData.recurrenceFrequency !== 'none' && (
                  <div className="pt-2 border-t border-purple-200 dark:border-purple-900/60 space-y-2 text-[11px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">Tần suất: Mỗi</span>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={formData.recurrenceInterval}
                          onChange={(e) => setFormData({ ...formData, recurrenceInterval: parseInt(e.target.value, 10) || 1 })}
                          className="w-16 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold text-center"
                        />
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">
                          {formData.recurrenceFrequency === 'daily' && 'ngày'}
                          {formData.recurrenceFrequency === 'weekly' && 'tuần'}
                          {formData.recurrenceFrequency === 'monthly' && 'tháng'}
                          {formData.recurrenceFrequency === 'yearly' && 'năm'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">Kết thúc:</span>
                        <select
                          value={formData.recurrenceEndCondition}
                          onChange={(e) => setFormData({ ...formData, recurrenceEndCondition: e.target.value as any })}
                          className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold"
                        >
                          <option value="never">Không giới hạn</option>
                          <option value="count">Sau số lần lặp</option>
                          <option value="until_date">Đến ngày nhất định</option>
                        </select>

                        {formData.recurrenceEndCondition === 'count' && (
                          <input
                            type="number"
                            min="2"
                            max="52"
                            value={formData.recurrenceEndCount}
                            onChange={(e) => setFormData({ ...formData, recurrenceEndCount: parseInt(e.target.value, 10) || 5 })}
                            className="w-16 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold text-center"
                            placeholder="Số lần"
                          />
                        )}

                        {formData.recurrenceEndCondition === 'until_date' && (
                          <input
                            type="date"
                            value={formData.recurrenceUntilDate}
                            onChange={(e) => setFormData({ ...formData, recurrenceUntilDate: e.target.value })}
                            className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Ghi Chú & Tùy Chọn Thêm */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Ghi Chú & Yêu Cầu Hỗ Trợ
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Yêu cầu chuẩn bị máy chiếu, micro không dây, nước uống tiếp khách, tài xế lái xe..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Vehicle specific: Need Driver Checkbox */}
              {resources.find(r => r.id === formData.resourceId)?.type === 'vehicle' && (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <input
                    type="checkbox"
                    id="needDriverCheck"
                    checked={formData.needDriver}
                    onChange={(e) => setFormData({ ...formData, needDriver: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 rounded"
                  />
                  <label htmlFor="needDriverCheck" className="text-xs font-bold text-emerald-900 dark:text-emerald-300 cursor-pointer">
                    Cần phân công tài xế công ty lái xe
                  </label>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/25 transition active:scale-95"
                >
                  {editingBookingId ? 'Cập Nhật Lịch' : 'Xác Nhận Đăng Ký'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: CHI TIẾT PHIẾU ĐĂNG KÝ (Xem chi tiết, đổi trạng thái, in phiếu) */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                    {selectedBooking.bookingCode}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(selectedBooking.status).bg}`}>
                    {getStatusBadge(selectedBooking.status).text}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {selectedBooking.title}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-slate-400 text-[11px]">Tài nguyên sử dụng:</p>
                  <p className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedBooking.resourceName}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Mã: {selectedBooking.resourceCode} • {selectedBooking.resourceLocation}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400 text-[11px]">Thời gian đặt:</p>
                  <p className="font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {selectedBooking.startTime} - {selectedBooking.endTime}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Ngày: {selectedBooking.startDate}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400 text-[11px]">Người đăng ký:</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedBooking.registrantName} ({selectedBooking.registrantCode})
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Phòng ban: {selectedBooking.department} • ĐT: {selectedBooking.registrantPhone || 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400 text-[11px]">Dự án liên quan:</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedBooking.projectName}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Quy mô: {selectedBooking.attendeeCount || 1} người tham gia
                  </p>
                </div>
              </div>

              {/* Recurrence detail */}
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-bold text-purple-900 dark:text-purple-200">
                      Quy luật lặp lại: {getRecurrenceLabel(selectedBooking.recurrence)}
                    </p>
                    <p className="text-[10px] text-purple-700 dark:text-purple-400">
                      {selectedBooking.recurrence.frequency === 'none' 
                        ? 'Phiếu sử dụng 1 lần duy nhất'
                        : `Lặp lại mỗi ${selectedBooking.recurrence.interval || 1} ${selectedBooking.recurrence.frequency}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">Ghi chú & Yêu cầu hỗ trợ:</p>
                  <p className="text-slate-800 dark:text-slate-200 italic">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Status quick switcher */}
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chuyển Trạng Thái Phiếu:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'confirmed')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 transition"
                  >
                    Đã Xác Nhận
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'in_use')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 transition"
                  >
                    Bắt Đầu Sử Dụng
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 transition"
                  >
                    Hoàn Tất & Trả
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'cancelled')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 transition"
                  >
                    Hủy Lịch
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <button
                onClick={() => handleDeleteBooking(selectedBooking.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-xl transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa Phiếu</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowPrintModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In Phiếu</span>
                </button>

                <button
                  onClick={() => handleEditBooking(selectedBooking)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow transition"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Chỉnh Sửa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: QUẢN LÝ DANH MỤC TÀI NGUYÊN */}
      {showResourceMgrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Danh Mục Tài Nguyên Doanh Nghiệp ({resources.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Phòng họp, xe ô tô, thiết bị CNTT sẵn sàng cho CBNV đăng ký sử dụng
                </p>
              </div>
              <button
                onClick={() => setShowResourceMgrModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resources.map(res => {
                  const ResIcon = getResourceIcon(res.type);
                  return (
                    <div 
                      key={res.id} 
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg text-white" style={{ backgroundColor: res.color }}>
                            <ResIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-slate-100">{res.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{res.code} • {res.capacity}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          res.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {res.status === 'available' ? 'Sẵn sàng' : 'Bảo dưỡng'}
                        </span>
                      </div>

                      <p className="text-slate-500 text-[11px] line-clamp-2">
                        {res.description}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
                        <span>📍 {res.location}</span>
                        <span>QL: {res.managedBy}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <button
                onClick={() => {
                  const reset = resourceBookingService.resetToDefault();
                  setResources(reset.resources);
                  setBookings(reset.bookings);
                  showToast.success('Đã khôi phục dữ liệu tài nguyên mẫu ban đầu!');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
              >
                Khôi phục dữ liệu mẫu ERP
              </button>

              <button
                onClick={() => setShowResourceMgrModal(false)}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: IN PHIẾU ĐĂNG KÝ TÀI NGUYÊN (Print Preview) */}
      {showPrintModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-4">
            <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-700">
              <p className="text-xs uppercase font-extrabold text-slate-500">CÔNG TY CỔ PHẦN TẬP ĐOÀN CÔNG NGHỆ DOANH NGHIỆP S-ERP</p>
              <h2 className="text-lg font-black mt-1">PHIẾU ĐĂNG KÝ SỬ DỤNG TÀI NGUYÊN</h2>
              <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">Số: {selectedBooking.bookingCode}</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Tài nguyên:</span>
                <span className="font-bold">{selectedBooking.resourceName} ({selectedBooking.resourceCode})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Mục đích:</span>
                <span className="font-semibold">{selectedBooking.title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Dự án:</span>
                <span className="font-bold">{selectedBooking.projectName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Người đăng ký:</span>
                <span className="font-bold">{selectedBooking.registrantName} - {selectedBooking.department}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Thời gian:</span>
                <span className="font-mono font-bold">{selectedBooking.startTime} - {selectedBooking.endTime} ({selectedBooking.startDate})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Quy luật lặp:</span>
                <span className="font-medium text-purple-600">{getRecurrenceLabel(selectedBooking.recurrence)}</span>
              </div>
              {selectedBooking.notes && (
                <div className="py-1 text-slate-500">
                  <span className="font-semibold">Ghi chú:</span> {selectedBooking.notes}
                </div>
              )}
            </div>

            <div className="pt-6 grid grid-cols-2 text-center text-xs">
              <div>
                <p className="font-bold">Người Đăng Ký</p>
                <p className="text-[10px] text-slate-400 italic">(Ký và ghi rõ họ tên)</p>
                <div className="h-16"></div>
                <p className="font-bold">{selectedBooking.registrantName}</p>
              </div>
              <div>
                <p className="font-bold">Ban Quản Lý Tài Nguyên</p>
                <p className="text-[10px] text-slate-400 italic">(Xác nhận bàn giao)</p>
                <div className="h-16"></div>
                <p className="font-bold">Đã Duyệt</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  showToast.success('Đang gửi lệnh in phiếu đăng ký tài nguyên ra máy in...');
                  setShowPrintModal(false);
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow"
              >
                Xác Nhận In Phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
