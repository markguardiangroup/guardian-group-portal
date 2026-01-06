# Guardian Group H&S Web Portal - Design Guidelines

## Design Approach
**Selected Framework:** Enterprise Design System (Carbon Design + Fluent Design principles)

**Rationale:** This is a utility-focused, information-dense B2B compliance platform where efficiency, clarity, and trust matter more than visual flair. Drawing from Carbon Design's data-heavy approach and Fluent's productivity patterns creates the optimal foundation for consultant and client workflows.

**Key References:** Linear (for clean data tables), Notion (for document organization), Asana (for status indicators), enterprise compliance platforms

---

## Typography System

**Font Family:**
- Primary: Inter (Google Fonts) - exceptional readability at all sizes
- Monospace: JetBrains Mono - for audit timestamps, version numbers

**Type Scale:**
- Page Titles: text-3xl font-semibold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card/Module Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Small Text/Meta: text-sm (14px)
- Timestamps/Labels: text-xs font-medium uppercase tracking-wide (12px)

---

## Layout System

**Spacing Primitives:** Tailwind units of 3, 4, 6, 8, 12, 16
- Component padding: p-6
- Card spacing: p-8
- Section margins: mb-8, mb-12
- Tight spacing (badges, inline): gap-3
- Generous spacing (between major sections): gap-16

**Grid Structure:**
- Dashboard: 12-column grid with sidebar (aside w-64, main flex-1)
- Document lists: Single column with full-width rows
- Compliance cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Two-column forms: grid-cols-1 lg:grid-cols-2 gap-8

**Container Constraints:**
- Max width: max-w-7xl for main content areas
- Forms: max-w-3xl for optimal completion
- Document viewer: Full width with contained reading pane

---

## Component Library

### Navigation
**Sidebar Navigation (Primary):**
- Fixed left sidebar (w-64)
- Sections: Dashboard, Documents, Assessments, Reports, Support, Settings
- Active state with left border accent (border-l-4)
- Icons from Heroicons (outline style)
- Subtle hover treatment

**Top Bar:**
- Client/entity switcher (dropdown with search)
- Breadcrumb navigation
- User profile dropdown
- Notification bell with badge count

### Document Management
**Document List View:**
- Table layout with columns: Name, Type, Status, Last Modified, Assigned To, Actions
- Row hover with elevation change
- Inline status badges (RAG indicators)
- Quick actions dropdown (kebab menu)

**Document Card (Alternative View):**
- Icon + title + metadata in compact card
- Status badge in top-right
- Click-to-preview functionality
- Secondary actions on hover

**Status Indicators (RAG System):**
- Red: Urgent/Overdue - badge with solid background
- Amber: Review Required - badge with medium opacity
- Green: Compliant - badge with light treatment
- Include icon + text for accessibility

### Dashboards
**Compliance Dashboard:**
- Summary cards grid (4 metrics across): Total Documents, Pending Review, Overdue Items, Compliance Score
- Each card: Large number, label, trend indicator, sparkline visual
- Quick action buttons below metrics
- Recent activity feed (chronological, max 10 items)
- Upcoming reviews timeline

**Entity/Site Overview:**
- Hierarchical tree view for multi-entity clients
- Expand/collapse functionality
- Compliance status per entity shown inline

### Forms & Inputs
**Standard Form Fields:**
- Label above input (text-sm font-medium mb-2)
- Input with subtle border, focus ring treatment
- Helper text below (text-sm text-gray-600)
- Error states with inline icon + message

**Document Upload Zone:**
- Dashed border drag-and-drop area
- Upload icon centered
- File type restrictions shown clearly
- Progress bars for uploads

**Approval Workflow:**
- Review document viewer (left) + approval panel (right)
- Comments/feedback textarea
- Approve/Reject/Request Changes buttons
- Audit trail timeline below

### Data Display
**Audit Trail:**
- Vertical timeline with connector lines
- Each entry: Icon, action, user, timestamp
- Expandable details for major actions
- Filter and search capability

**Report Preview:**
- Document preview pane with toolbar
- Export options (PDF, Word)
- Print preview mode

### Support & Communication
**Support Request Form:**
- Priority selector (dropdown)
- Category tags
- Rich text editor for description
- File attachment support
- Request history view

---

## Responsive Behavior

**Desktop-First Approach** (most users are consultants on laptops):
- Optimize for 1440px+ primary viewport
- Sidebar always visible on desktop
- Multi-column layouts maintained

**Tablet (768px-1024px):**
- Collapsible sidebar with hamburger toggle
- Reduce to 2-column grids
- Stack complex forms

**Mobile (<768px):**
- Hidden sidebar, hamburger menu
- Single column layouts
- Bottom navigation bar for core actions
- Simplified tables (show key columns only, expandable rows)

---

## Micro-Interactions (Minimal)

**Purposeful Only:**
- Smooth page transitions (150ms ease)
- Button hover: slight elevation increase
- Status badge pulse on change
- Notification slide-in from top-right
- Loading states with skeleton screens (not spinners)

**Avoid:** Unnecessary animations, scroll effects, decorative motion

---

## Design Principles Summary

1. **Clarity Over Aesthetics:** Information density balanced with readability
2. **Trust Through Consistency:** Predictable patterns, no surprises
3. **Efficiency-Driven:** Minimize clicks, maximize scan-ability
4. **Role-Appropriate Views:** Consultants see tools, clients see clarity
5. **Audit-First Mindset:** Every action visible, traceable, timestamped