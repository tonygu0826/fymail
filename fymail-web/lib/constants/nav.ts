import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  FileText,
  Zap,
  CheckSquare,
  Activity,
  Settings,
  BarChart2,
} from "lucide-react";

export const NAV_ITEMS = [
  {
    section: "概览",
    items: [
      {
        label: "工作台",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    section: "拓客工作",
    items: [
      {
        label: "市场情报",
        href: "/intelligence",
        icon: Search,
        description: "搜索目标公司",
      },
      {
        label: "联系人",
        href: "/contacts",
        icon: Users,
        description: "联系人池管理",
      },
      {
        label: "活动管理",
        href: "/campaigns",
        icon: Mail,
        description: "邮件拓客活动",
      },
      {
        label: "模板库",
        href: "/templates",
        icon: FileText,
        description: "开发信模板",
      },
    ],
  },
  {
    section: "流程控制",
    items: [
      {
        label: "自动化",
        href: "/automation",
        icon: Zap,
        description: "自动化规则",
      },
      {
        label: "审批",
        href: "/approvals",
        icon: CheckSquare,
        description: "审批队列",
        badgeKey: "pendingApprovals" as const,
      },
    ],
  },
  {
    section: "系统",
    items: [
      {
        label: "数据统计",
        href: "/analytics",
        icon: BarChart2,
        description: "拓客效果分析",
      },
      {
        label: "系统状态",
        href: "/status",
        icon: Activity,
        description: "健康监控",
      },
      {
        label: "设置",
        href: "/settings/email",
        icon: Settings,
      },
    ],
  },
];
