import React from 'react';
import {
  BarChart,
  Layers,
  ShoppingBag,
  DollarSign,
  Users,
  FileSpreadsheet,
  Bot,
  Settings,
  FolderTree,
  Building2,
  Package,
  Warehouse,
  Tag,
  Scale,
  ArrowRightLeft,
  ShieldAlert,
  Boxes,
  MapPin,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  UserCheck,
  CreditCard,
  LucideProps
} from 'lucide-react';

interface DynamicIconProps extends LucideProps {
  name: string;
}

const iconMap: Record<string, React.FC<LucideProps>> = {
  BarChart,
  Layers,
  ShoppingBag,
  DollarSign,
  Users,
  FileSpreadsheet,
  Bot,
  Settings,
  FolderTree,
  Building2,
  Package,
  Warehouse,
  Tag,
  Scale,
  ArrowRightLeft,
  ShieldAlert,
  Boxes,
  MapPin,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  UserCheck,
  CreditCard
};

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const IconComponent = iconMap[name] || FileText;
  return <IconComponent {...props} />;
};
