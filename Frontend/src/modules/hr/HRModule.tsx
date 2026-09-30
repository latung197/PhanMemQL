import React from 'react';
import { SubMenuKey, Employee, UserProfile } from '../../types';
import { EmployeeCategoryView } from './EmployeeCategoryView';
import { PayrollForm } from './PayrollForm';
import { HRReportView } from './HRReportView';
import { ResourceBookingTimetable } from '../resources/ResourceBookingTimetable';
import { Users, FileText, PieChart, CalendarDays, Sparkles } from 'lucide-react';

interface HRModuleProps {
  subKey: SubMenuKey;
  onSelectSubKey: (key: SubMenuKey) => void;
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  currentUser?: UserProfile;
}

export const HRModule: React.FC<HRModuleProps> = ({
  subKey,
  onSelectSubKey,
  employees,
  onAddEmployee,
  currentUser
}) => {
  const tabs: { key: SubMenuKey; label: string; icon: any; isNew?: boolean }[] = [
    {
      key: 'hr_list',
      label: 'Hồ Sơ Cán Bộ & Nhân Sự',
      icon: Users
    },
    {
      key: 'hr_payroll',
      label: 'Chấm Công & Quỹ Lương',
      icon: FileText
    },
    {
      key: 'hr_resource_booking',
      label: 'Đăng Ký & Thời Khóa Biểu Tài Nguyên',
      icon: CalendarDays,
      isNew: true
    },
    {
      key: 'hr_report',
      label: 'Báo Cáo Biến Động HR',
      icon: PieChart
    }
  ];

  const renderActiveView = () => {
    switch (subKey) {
      case 'hr_list':
        return <EmployeeCategoryView employees={employees} onAddEmployee={onAddEmployee} currentUser={currentUser} />;
      case 'hr_payroll':
        return <PayrollForm employees={employees} />;
      case 'hr_resource_booking':
        return <ResourceBookingTimetable currentUser={currentUser} employees={employees} />;
      case 'hr_report':
        return <HRReportView employees={employees} />;
      default:
        return <ResourceBookingTimetable currentUser={currentUser} employees={employees} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top HR Sub-module Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl shadow-xs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = subKey === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectSubKey(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.isNew && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase flex items-center gap-0.5 ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                }`}>
                  <Sparkles className="h-2.5 w-2.5" /> Mới
                </span>
              )}
            </button>
          );
        })}
      </div>

      {renderActiveView()}
    </div>
  );
};
