import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Flag,
  Heart,
  Home,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Upload,
  UserCheck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { agents, deals, lodges as initialLodges, reports, type Lodge, type Role } from "./data/mock";
import { Badge, Button, Card, Input, Select } from "./components/ui";
import { cn, currency, shortNumber } from "./lib/utils";

// Main navigation shown in both the desktop header and mobile menu.
const nav = [
  { href: "/", label: "Home" },
  { href: "/lodges", label: "Lodges" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Login" }
];

// Converts local Nigerian phone formats into a WhatsApp-friendly international URL.
function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

// Frontend session shape mirrors the public user payload returned by the API.
type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  verified: boolean;
  emailVerified?: boolean;
  phone?: string;
  photo?: string;
  photoUrl?: string;
  nin?: string;
  ninDocumentUrl?: string;
  accountStatus?: "active" | "pending" | "restricted";
  securityVerified?: boolean;
  banned?: boolean;
  createdAt?: string;
};

type CommissionSettings = {
  mode: "percentage" | "fixed";
  value: number;
};

type TransactionStatus = "pending_confirmation" | "confirmed" | "rejected";

type LodgeTransaction = {
  id: string;
  lodgeId: string;
  lodgeTitle: string;
  studentName: string;
  studentEmail: string;
  agentName: string;
  amountPaid: number;
  commissionAmount: number;
  status: TransactionStatus;
  createdAt: string;
};

type PlatformMessage = {
  id: string;
  lodgeId: string;
  lodgeTitle: string;
  studentEmail: string;
  studentName: string;
  agentName: string;
  messages: Array<{ senderEmail: string; senderName: string; body: string; createdAt: string }>;
};

type PlatformReport = {
  id: string;
  lodgeId: string;
  lodgeTitle: string;
  reporterName: string;
  reporterEmail: string;
  agentName: string;
  reason: string;
  status: "open" | "reviewing" | "resolved";
  createdAt: string;
};

type PlatformNotification = {
  id: string;
  audience: "admin" | "agent" | "student";
  target?: string;
  title: string;
  body: string;
  createdAt: string;
  read?: boolean;
};

type PlatformAudit = {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
};

// Demo accounts keep the app usable when localStorage has no saved users yet.
const seedMembers: AppUser[] = [
  { id: "usr_admin", name: "Zik Lodge Programmer", email: "admin@ziklodge.test", phone: "+2348000000000", role: "admin", verified: true, emailVerified: true, accountStatus: "active", createdAt: "Seed admin" },
  { id: "usr_agent", name: "Adaeze Okafor", email: "agent@ziklodge.test", phone: "+2348031112048", role: "agent", verified: true, emailVerified: true, accountStatus: "active", createdAt: "Seed agent" },
  { id: "usr_student", name: "Ngozi Eze", email: "student@ziklodge.test", phone: "+2348060000000", role: "student", verified: true, emailVerified: true, accountStatus: "active", createdAt: "Seed student" }
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const profileImageMaxBytes = 2 * 1024 * 1024;

// Regex catches invalid shape; OTP delivery proves the mailbox works after deployment.
function isValidEmailAddress(value: string) {
  const domain = value.toLowerCase().split("@")[1];
  return emailPattern.test(value) && Boolean(domain) && !domain.includes("..");
}

function cleanElevenDigitPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidElevenDigitPhone(value: string) {
  return /^0\d{10}$/.test(value);
}

// File uploads are stored as data URLs in the frontend demo flow.
function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

type ApiLodge = {
  id: string;
  title: string;
  location: string;
  universityId: string;
  price: number;
  type: Lodge["type"];
  distanceKm: number;
  availableRooms: number;
  status: "pending" | "approved" | "rejected" | "occupied";
  images: string[];
  amenities: string[];
  description: string;
};

// API lodge records use backend status names, so this adapter maps them to UI labels.
function adaptApiLodge(lodge: ApiLodge): Lodge {
  return {
    id: lodge.id,
    title: lodge.title,
    location: lodge.location,
    university: lodge.universityId === "unizik" ? "Nnamdi Azikiwe University" : lodge.universityId,
    price: lodge.price,
    type: lodge.type,
    distanceKm: lodge.distanceKm,
    availableRooms: lodge.availableRooms,
    status: lodge.status === "occupied" ? "occupied" : lodge.status === "approved" ? "available" : "pending",
    verified: lodge.status === "approved",
    featured: false,
    rating: 4.6,
    agent: "Verified agent",
    phone: "+234 803 111 2048",
    whatsapp: whatsappLink("+2348031112048"),
    description: lodge.description,
    amenities: lodge.amenities,
    images: lodge.images
  };
}

// These helpers isolate localStorage parsing so a bad saved value does not crash React.
function getStoredUser() {
  try {
    const stored = localStorage.getItem("zik_lodge_user");
    return stored ? (JSON.parse(stored) as AppUser) : null;
  } catch {
    return null;
  }
}

function getStoredMembers() {
  try {
    const stored = localStorage.getItem("zik_lodge_members");
    return stored ? (JSON.parse(stored) as AppUser[]) : seedMembers;
  } catch {
    return seedMembers;
  }
}

function App() {
  // App-level state is intentionally centralized because dashboards share transactions,
  // messages, reports, notifications, and lodge availability in this prototype.
  const [dark, setDark] = useState(false);
  const [marketLodges, setMarketLodges] = useState<Lodge[]>(initialLodges);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());
  const [members, setMembers] = useState<AppUser[]>(() => getStoredMembers());
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({ mode: "fixed", value: 0 });
  const [transactions, setTransactions] = useState<LodgeTransaction[]>([]);
  const [messageThreads, setMessageThreads] = useState<PlatformMessage[]>([]);
  const [reportInbox, setReportInbox] = useState<PlatformReport[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAudit[]>([]);

  // Persist locally created users between browser refreshes.
  useEffect(() => {
    localStorage.setItem("zik_lodge_members", JSON.stringify(members));
  }, [members]);

  // Prefer live API listings when the backend is running; keep mock data as a fallback.
  useEffect(() => {
    fetch("/api/lodges")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Could not load lodges"))))
      .then((data: ApiLodge[]) => {
        if (Array.isArray(data) && data.length) setMarketLodges(data.map(adaptApiLodge));
      })
      .catch(() => undefined);
  }, []);

  // Upserts users by email so repeated login/register events do not duplicate accounts.
  function addOrUpdateMember(user: AppUser) {
    setMembers((items) => {
      const exists = items.some((item) => item.email === user.email);
      return exists ? items.map((item) => (item.email === user.email ? { ...item, ...user } : item)) : [user, ...items];
    });
  }

  // Keeps React state and localStorage in sync for login/logout.
  function updateCurrentUser(user: AppUser | null) {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem("zik_lodge_user", JSON.stringify(user));
      addOrUpdateMember(user);
    } else {
      localStorage.removeItem("zik_lodge_user");
      localStorage.removeItem("zik_lodge_token");
    }
  }

  // Admin-side action that marks an agent ready to operate on the marketplace.
  function approveAgent(email: string) {
    const agent = members.find((member) => member.email === email);
    setMembers((items) => items.map((item) => (item.email === email ? { ...item, verified: true, accountStatus: "active" } : item)));
    if (currentUser?.email === email) {
      updateCurrentUser({ ...currentUser, verified: true, accountStatus: "active" });
    }
    pushNotification({
      audience: "admin",
      title: "Agent account verified",
      body: `${agent?.name ?? email} was approved and moved to active.`
    });
    pushAudit("Admin", "agent.approved", email);
  }

  // Account restrictions immediately affect the logged-in user if they are editing themselves.
  function updateMemberStatus(email: string, accountStatus: AppUser["accountStatus"]) {
    const member = members.find((item) => item.email === email);
    setMembers((items) => items.map((item) => (item.email === email ? { ...item, accountStatus, verified: accountStatus === "active" ? item.verified : false } : item)));
    if (currentUser?.email === email) {
      updateCurrentUser({ ...currentUser, accountStatus, verified: accountStatus === "active" ? currentUser.verified : false });
    }
    pushNotification({
      audience: "admin",
      title: "Account status updated",
      body: `${member?.name ?? email} is now ${accountStatus}.`
    });
    pushAudit("Admin", "account.status_changed", `${email} -> ${accountStatus}`);
  }

  // Rejection keeps the agent pending so they can correct verification details later.
  function rejectAgent(email: string) {
    const agent = members.find((member) => member.email === email);
    setMembers((items) => items.map((item) => (item.email === email ? { ...item, verified: true, accountStatus: "pending" } : item)));
    pushNotification({
      audience: "admin",
      title: "Agent account kept pending",
      body: `${agent?.name ?? email} was rejected and remains pending.`
    });
    pushAudit("Admin", "agent.rejected", email);
  }

  // Lightweight in-memory notifications power the dashboard activity feeds.
  function pushNotification(notification: Omit<PlatformNotification, "id" | "createdAt" | "read">) {
    setNotifications((items) => [{ id: `ntf-${Date.now()}`, createdAt: new Date().toLocaleString(), read: false, ...notification }, ...items]);
  }

  // Audit entries make admin actions traceable in the UI prototype.
  function pushAudit(actor: string, action: string, target: string) {
    setAuditLogs((items) => [{ id: `aud-${Date.now()}`, actor, action, target, createdAt: new Date().toLocaleString() }, ...items]);
  }

  // Commission is disabled for now, so local demo transactions keep this at zero.
  function calculateLocalCommission(amount: number) {
    void amount;
    return 0;
  }

  // Students use this when they mark a lodge as successfully obtained.
  function initiateTransaction(lodge: Lodge) {
    if (!currentUser) return { ok: false, message: "Please login before marking a lodge." };
    const duplicate = transactions.find((transaction) => transaction.lodgeId === lodge.id && transaction.studentEmail === currentUser.email && transaction.status !== "rejected");
    if (duplicate) return { ok: false, message: "You already submitted this lodge claim. Track it from your student dashboard." };

    const transaction: LodgeTransaction = {
      id: `txn-${Date.now()}`,
      lodgeId: lodge.id,
      lodgeTitle: lodge.title,
      studentName: currentUser.name,
      studentEmail: currentUser.email,
      agentName: lodge.agent,
      amountPaid: lodge.price,
      commissionAmount: calculateLocalCommission(lodge.price),
      status: "pending_confirmation",
      createdAt: new Date().toLocaleString()
    };
    setTransactions((items) => [transaction, ...items]);
    pushAudit(currentUser.name, "transaction.initiated", lodge.title);
    pushNotification({
      audience: "agent",
      target: lodge.agent,
      title: "New lodge claim",
      body: `${currentUser.name} clicked "I Got This Lodge" for ${lodge.title}. Confirm or reject it from your agent dashboard.`
    });
    return { ok: true, message: "Transaction created. Waiting for agent confirmation." };
  }

  // Creates or appends to the conversation thread for a lodge.
  function sendThreadMessage(lodge: Lodge, sender: AppUser, body: string) {
    const threadId = `${lodge.id}-${sender.role === "agent" ? "agent" : sender.email}`;
    const nextMessage = { senderEmail: sender.email, senderName: sender.name, body, createdAt: new Date().toLocaleString() };
    setMessageThreads((items) => {
      const existing = items.find((item) => item.id === threadId);
      if (existing) {
        return items.map((item) => (item.id === threadId ? { ...item, messages: [...item.messages, nextMessage] } : item));
      }
      return [
        {
          id: threadId,
          lodgeId: lodge.id,
          lodgeTitle: lodge.title,
          studentEmail: sender.role === "student" ? sender.email : "",
          studentName: sender.role === "student" ? sender.name : "Student",
          agentName: lodge.agent,
          messages: [nextMessage]
        },
        ...items
      ];
    });
    pushNotification({
      audience: sender.role === "student" ? "agent" : "student",
      target: sender.role === "student" ? lodge.agent : undefined,
      title: "New in-site message",
      body: `${sender.name} sent a message about ${lodge.title}.`
    });
  }

  // Replies stay attached to an existing thread so admins can review full context.
  function sendThreadReply(threadId: string, sender: AppUser, body: string) {
    const thread = messageThreads.find((item) => item.id === threadId);
    if (!thread) return;
    const nextMessage = { senderEmail: sender.email, senderName: sender.name, body, createdAt: new Date().toLocaleString() };
    setMessageThreads((items) => items.map((item) => (item.id === threadId ? { ...item, messages: [...item.messages, nextMessage] } : item)));
    pushNotification({
      audience: sender.role === "agent" ? "student" : "agent",
      target: sender.role === "agent" ? thread.studentEmail : thread.agentName,
      title: "New in-site message",
      body: `${sender.name} replied about ${thread.lodgeTitle}.`
    });
  }

  // Student reports feed the admin dashboard and notification list.
  function submitPlatformReport(lodge: Lodge, reporter: AppUser, reason: string) {
    const report: PlatformReport = {
      id: `rpt-${Date.now()}`,
      lodgeId: lodge.id,
      lodgeTitle: lodge.title,
      reporterName: reporter.name,
      reporterEmail: reporter.email,
      agentName: lodge.agent,
      reason,
      status: "open",
      createdAt: new Date().toLocaleString()
    };
    setReportInbox((items) => [report, ...items]);
    pushAudit(reporter.name, "report.created", lodge.title);
    pushNotification({
      audience: "admin",
      title: "New lodge report",
      body: `${reporter.name} reported ${lodge.title}: ${reason}`
    });
    return report;
  }

  // Confirming a transaction also marks the lodge occupied in the marketplace.
  function updateTransactionStatus(id: string, status: TransactionStatus) {
    setTransactions((items) => items.map((transaction) => (transaction.id === id ? { ...transaction, status } : transaction)));
    if (status === "confirmed") {
      const transaction = transactions.find((item) => item.id === id);
      if (transaction) {
        setMarketLodges((items) => items.map((lodge) => (lodge.id === transaction.lodgeId ? { ...lodge, status: "occupied" } : lodge)));
      }
    }
  }

  // Admin approval controls which agent-uploaded lodges become publicly available.
  function updateLodgeStatus(id: string, status: Lodge["status"]) {
    setMarketLodges((items) => items.map((lodge) => (
      lodge.id === id ? { ...lodge, status, verified: status === "available" ? true : lodge.verified && status !== "pending" } : lodge
    )));
    const lodge = marketLodges.find((item) => item.id === id);
    pushAudit("Admin", "lodge.status_changed", `${lodge?.title ?? id} -> ${status}`);
  }

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground">
        <Header dark={dark} setDark={setDark} currentUser={currentUser} onLogout={() => updateCurrentUser(null)} />
        <Routes>
          <Route path="/" element={<HomePage lodges={marketLodges} currentUser={currentUser} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/lodges" element={<ProtectedPage currentUser={currentUser}><ListingsPage lodges={marketLodges} /></ProtectedPage>} />
          <Route path="/lodges/:id" element={<ProtectedPage currentUser={currentUser}><LodgeDetailsPage lodges={marketLodges} currentUser={currentUser} threads={messageThreads} onSendMessage={sendThreadMessage} onSubmitReport={submitPlatformReport} onGotLodge={initiateTransaction} /></ProtectedPage>} />
          <Route path="/student" element={<ProtectedPage currentUser={currentUser} roles={["student", "admin"]}><StudentDashboard currentUser={currentUser} lodges={marketLodges} transactions={transactions} threads={messageThreads} notifications={notifications} onSendMessage={sendThreadMessage} /></ProtectedPage>} />
          <Route path="/agent" element={<ProtectedPage currentUser={currentUser} roles={["agent", "admin"]}><AgentDashboard currentUser={currentUser} onVerify={approveAgent} lodges={marketLodges} transactions={transactions} threads={messageThreads} notifications={notifications} onSendMessage={sendThreadMessage} onSendThreadReply={sendThreadReply} onTransactionStatus={updateTransactionStatus} onAddLodge={(lodge) => setMarketLodges((items) => [lodge, ...items])} /></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage currentUser={currentUser} roles={["admin"]}><AdminDashboard members={members} lodges={marketLodges} transactions={transactions} reportsInbox={reportInbox} notifications={notifications} auditLogs={auditLogs} commissionSettings={commissionSettings} onCommissionSettingsChange={setCommissionSettings} onTransactionStatus={updateTransactionStatus} onApproveAgent={approveAgent} onRejectAgent={rejectAgent} onMemberStatus={updateMemberStatus} /></ProtectedPage>} />
          <Route path="/login" element={<AuthPage onAuth={updateCurrentUser} />} />
          <Route path="/register" element={<AuthPage register onAuth={updateCurrentUser} />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          
          <Route path="/verify" element={<ProtectedPage currentUser={currentUser} roles={["agent", "admin"]}><VerificationPage /></ProtectedPage>} />
          <Route path="/favorites" element={<ProtectedPage currentUser={currentUser}><FavoritesPage lodges={marketLodges} /></ProtectedPage>} />
          <Route path="/privacy" element={<PolicyPage type="privacy" />} />
          <Route path="/terms" element={<PolicyPage type="terms" />} />
          <Route path="/refund-commission-policy" element={<PolicyPage type="refund" />} />
          <Route path="/report-abuse-policy" element={<PolicyPage type="abuse" />} />
        </Routes>
        <Footer />
      </div>
    </div>
  );
}

// Top navigation handles auth-aware dashboard links and responsive mobile toggling.
function Header({ dark, setDark, currentUser, onLogout }: { dark: boolean; setDark: (value: boolean) => void; currentUser: AppUser | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dashboard = currentUser?.role === "admin" ? "/admin" : currentUser?.role === "agent" ? "/agent" : "/student";
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="page-shell flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-black">
          <span className="grid size-11 place-items-center rounded-md border border-border bg-white p-1 shadow-sm">
            <img className="h-full w-full object-contain" src="/unizikpic.png" alt="UNIZIK logo" />
          </span>
          <span>Zik Lodge</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn("rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground", isActive && "bg-secondary text-foreground")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="size-10 px-0" onClick={() => setDark(!dark)} aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          {currentUser ? (
            <>
              <Link to={dashboard} className="hidden md:block">
                <Button variant="secondary">{currentUser.name.split(" ")[0]}</Button>
              </Link>
              <Button
                className="hidden md:inline-flex"
                onClick={() => {
                  onLogout();
                  navigate("/login");
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Link to="/register" className="hidden md:block">
              <Button>List a lodge</Button>
            </Link>
          )}
          <Button variant="secondary" className="size-10 px-0 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            <Menu size={20} />
          </Button>
        </div>
      </div>
      {open ? (
        <div className="page-shell grid gap-2 pb-4 md:hidden">
          {nav.map((item) => (
            <NavLink key={item.href} to={item.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 font-semibold hover:bg-secondary">
              {item.label}
            </NavLink>
          ))}
          {currentUser ? (
            <button
              className="rounded-md px-3 py-2 text-left font-semibold hover:bg-secondary"
              onClick={() => {
                onLogout();
                setOpen(false);
                navigate("/login");
              }}
            >
              Logout
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

// Route guard used by private pages and role-specific dashboards.
function ProtectedPage({ currentUser, roles, children }: { currentUser: AppUser | null; roles?: Role[]; children: React.ReactNode }) {
  if (!currentUser) {
    return (
      <main className="page-shell grid min-h-[calc(100vh-8rem)] place-items-center py-16">
        <Card className="max-w-xl p-6 text-center">
          <Badge><Lock size={14} /> Account required</Badge>
          <h1 className="mt-4 text-3xl font-black">Create an account to continue</h1>
          <p className="mt-3 text-muted-foreground">You need to login before you can browse lodges, view agent details, chat, save favorites, or use dashboards.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/login"><Button>Login</Button></Link>
            <Link to="/register"><Button variant="secondary">Create account</Button></Link>
          </div>
        </Card>
      </main>
    );
  }

  if (currentUser.accountStatus === "restricted") {
    return (
      <main className="page-shell grid min-h-[calc(100vh-8rem)] place-items-center py-16">
        <Card className="max-w-xl p-6 text-center">
          <Badge><Lock size={14} /> Account restricted</Badge>
          <h1 className="mt-4 text-3xl font-black">Your account has been restricted by admin.</h1>
          <p className="mt-3 text-muted-foreground">Please contact the Zik Lodge support team if you believe this is a mistake.</p>
        </Card>
      </main>
    );
  }

  if (roles && !roles.includes(currentUser.role)) {
    return (
      <main className="page-shell grid min-h-[calc(100vh-8rem)] place-items-center py-16">
        <Card className="max-w-xl p-6 text-center">
          <Badge><ShieldCheck size={14} /> Restricted</Badge>
          <h1 className="mt-4 text-3xl font-black">This page is for {roles.join(" or ")} users only.</h1>
          <p className="mt-3 text-muted-foreground">Admin tools are visible only to the programmer/admin account.</p>
        </Card>
      </main>
    );
  }

  return children;
}

// Landing page combines search, featured listings, trust signals, and calls to action.
function HomePage({ lodges, currentUser }: { lodges: Lodge[]; currentUser: AppUser | null }) {
  return (
    <>
      <section className="noise overflow-hidden">
        <div className="page-shell grid min-h-[calc(100vh-4rem)] items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <Badge className="mb-5 bg-accent text-accent-foreground">Verified lodges around UNIZIK</Badge>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
              Find your next student lodge without the stress.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Zik Lodge connects UNIZIK students with verified agents, real lodge photos, transparent prices, reports, and successful deal tracking.
            </p>
            <SearchPanel compact={false} />
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="relative">
            <img
              className="h-[520px] w-full rounded-lg object-cover shadow-soft"
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1500&q=80"
              alt="Modern student apartment interior"
            />
            <Card className="absolute bottom-5 left-5 max-w-[270px] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-md bg-secondary text-primary">
                  <ShieldCheck />
                </span>
                <div>
                  <p className="font-black text-foreground">Agent verified</p>
                  <p className="text-sm text-muted-foreground">KYC, listing approval, and report tracking.</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
      <FeaturedLodges lodges={lodges} currentUser={currentUser} />
      <HowItWorks />
      <VerifiedAgents />
      <Testimonials />
      <CTA />
    </>
  );
}

// Shared lodge search form; in compact mode it sits inside the hero.
function SearchPanel({ compact = true }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [type, setType] = useState("");
  const [distance, setDistance] = useState("");

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (location) params.set("q", location);
    if (budget) params.set("maxPrice", budget);
    if (type) params.set("type", type);
    if (distance) params.set("distance", distance);
    navigate(`/lodges?${params.toString()}`);
  }

  return (
    <Card as="form" className={cn("mt-8 grid gap-3 p-3 shadow-soft", compact ? "md:grid-cols-5" : "md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]")} onSubmit={handleSearch}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input value={location} onChange={(event) => setLocation(event.target.value)} className="pl-10" placeholder="Ifite, Temp Site, Perm Site" />
      </div>
      <Select value={budget} onChange={(event) => setBudget(event.target.value)}>
        <option value="">Any price</option>
        <option value="300000">Under ₦300k</option>
        <option value="500000">Under ₦500k</option>
        <option value="800000">Under ₦800k</option>
        <option value="1.5m"> Under ₦1.5m</option>
      </Select>
      <Select value={type} onChange={(event) => setType(event.target.value)}>
        <option value="">Lodge type</option>
        <option>Self-contained</option>
        <option>Single room</option>
        <option>Flat</option>
        <option>Shared apartment</option>
      </Select>
      <Select value={distance} onChange={(event) => setDistance(event.target.value)}>
        <option value="">Distance</option>
        <option value="1">Under 1km</option>
        <option value="3">Under 3km</option>
        <option value="5">Under 5km</option>
      </Select>
      <Button type="submit" className="w-full">
        Search <ChevronRight size={18} />
      </Button>
    </Card>
  );
}

// Featured listings are filtered to approved/available lodges before rendering cards.
function FeaturedLodges({ lodges, currentUser }: { lodges: Lodge[]; currentUser: AppUser | null }) {
  return (
    <section className="page-shell py-16">
      <SectionTitle icon={<Sparkles />} eyebrow="Featured" title="Fresh verified rooms students are viewing now" />
      {currentUser ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {lodges.filter((lodge) => lodge.featured && lodge.status === "available").map((lodge) => (
            <LodgeCard key={lodge.id} lodge={lodge} />
          ))}
        </div>
      ) : (
        <Card className="mt-8 grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-2xl font-black">Login to view verified lodge listings</h3>
            <p className="mt-2 text-muted-foreground">Students and agents need an account before viewing lodge details, contact information, favorites, reports, and chat.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/login"><Button>Login</Button></Link>
            <Link to="/register"><Button variant="secondary">Create account</Button></Link>
          </div>
        </Card>
      )}
    </section>
  );
}

// Reusable marketplace card for lodge summaries.
function LodgeCard({ lodge }: { lodge: Lodge }) {
  return (
    <Card className="group overflow-hidden">
      <Link to={`/lodges/${lodge.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={lodge.images[0]} alt={lodge.title} />
          <div className="absolute left-3 top-3 flex gap-2">
            {lodge.verified ? <Badge className="bg-primary text-primary-foreground">Verified</Badge> : <Badge>Pending</Badge>}
            <Badge className="bg-accent text-accent-foreground">{lodge.status}</Badge>
          </div>
          <Button variant="secondary" className="absolute right-3 top-3 size-10 px-0" aria-label="Save favorite">
            <Heart size={18} />
          </Button>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">{lodge.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin size={15} /> {lodge.location}
              </p>
            </div>
            <span className="flex items-center gap-1 text-sm font-bold">
              <Star className="fill-accent text-accent" size={16} /> {lodge.rating}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
            <span>{lodge.type}</span>
            <span>{lodge.distanceKm}km from school</span>
            <span>{lodge.availableRooms} rooms left</span>
          </div>
          <p className="mt-4 text-xl font-black text-primary">{currency(lodge.price)} / year</p>
        </div>
      </Link>
    </Card>
  );
}

// Static onboarding steps for students, agents, and admins.
function HowItWorks() {
  const steps = [
    { icon: <Search />, title: "Search by budget", text: "Filter lodges by location, price, type, distance, and room availability." },
    { icon: <ShieldCheck />, title: "Verify before paying", text: "See approved agents, multiple images, reports, ratings, and listing status." },
    { icon: <CheckCircle2 />, title: "Record successful deals", text: "Students mark a lodge as secured, and agents confirm the successful claim." }
  ];
  return (
    <section className="bg-card py-16">
      <div className="page-shell">
        <SectionTitle icon={<LayoutDashboard />} eyebrow="Flow" title="Built for the real student accommodation journey" />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="p-5">
              <span className="grid size-12 place-items-center rounded-md bg-secondary text-primary">{step.icon}</span>
              <h3 className="mt-5 text-xl font-black">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// Agent reputation block built from mock agent stats.
function VerifiedAgents() {
  return (
    <section className="page-shell py-16">
      <SectionTitle icon={<UserCheck />} eyebrow="Agents" title="Trusted lodge agents with visible performance" />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.name} className="p-5">
            <div className="flex items-center justify-between">
              <div className="grid size-14 place-items-center rounded-md bg-primary text-xl font-black text-primary-foreground">{agent.name.slice(0, 1)}</div>
              <Badge className="bg-secondary text-primary">Verified</Badge>
            </div>
            <h3 className="mt-5 text-xl font-black">{agent.name}</h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric label="Listings" value={agent.listings} />
              <Metric label="Deals" value={agent.deals} />
              <Metric label="Rating" value={agent.rating} />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Social proof shown on the home page.
function Testimonials() {
  return (
    <section className="bg-secondary py-16">
      <div className="page-shell grid gap-5 md:grid-cols-3">
        {["I found a room near Ifite and confirmed the agent before inspection.", "The report button made me confident because fake posts get reviewed.", "Every confirmed deal is visible to admin."].map((text, index) => (
          <Card key={text} className="p-5">
            <div className="flex gap-1 text-accent">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="fill-current" size={16} />)}</div>
            <p className="mt-4 text-foreground">{text}</p>
            <p className="mt-4 text-sm font-bold text-muted-foreground">UNIZIK user {index + 1}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Final home-page prompt that routes users toward registration.
function CTA() {
  return (
    <section className="page-shell py-16">
      <div className="rounded-lg bg-primary p-8 text-primary-foreground md:p-12">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-3xl font-black md:text-5xl">Ready to secure a verified lodge?</h2>
            <p className="mt-3 max-w-2xl text-primary-foreground/80">Students can save listings and chat. Agents can upload rooms and manage occupancy.</p>
          </div>
          <Link to="/lodges">
            <Button className="bg-accent text-accent-foreground hover:bg-accent">Browse lodges</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// Searchable lodge index with local filters for location, type, and price.
function ListingsPage({ lodges }: { lodges: Lodge[] }) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [maxDistance, setMaxDistance] = useState(searchParams.get("distance") ?? "");
  const [minRooms, setMinRooms] = useState(searchParams.get("rooms") ?? "");
  const filtered = useMemo(() => {
    return lodges.filter((lodge) => {
      const matchesQuery = `${lodge.title} ${lodge.location}`.toLowerCase().includes(query.toLowerCase());
      const matchesType = !type || lodge.type === type;
      const matchesPrice = !maxPrice || lodge.price <= Number(maxPrice);
      const matchesDistance = !maxDistance || lodge.distanceKm <= Number(maxDistance);
      const matchesRooms = !minRooms || lodge.availableRooms >= Number(minRooms);
      return lodge.status === "available" && matchesQuery && matchesType && matchesPrice && matchesDistance && matchesRooms;
    });
  }, [lodges, query, type, maxPrice, maxDistance, minRooms]);

  return (
    <main className="page-shell py-10">
      <SectionTitle icon={<Home />} eyebrow="Lodges" title="Browse available student lodges" />
      <Card className="mt-8 grid gap-3 p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search location or lodge name" />
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          <option>Self-contained</option>
          <option>Single room</option>
          <option>Flat</option>
          <option>Shared apartment</option>
        </Select>
        <Select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
          <option value="">Any budget</option>
          <option value="300000">Up to ₦300k</option>
          <option value="500000">Up to ₦500k</option>
          <option value="800000">Up to ₦800k</option>
        </Select>
        <Select value={maxDistance} onChange={(event) => setMaxDistance(event.target.value)}>
          <option value="">Any distance</option>
          <option value="1">Under 1km</option>
          <option value="3">Under 3km</option>
          <option value="5">Under 5km</option>
        </Select>
        <Select value={minRooms} onChange={(event) => setMinRooms(event.target.value)}>
          <option value="">Any rooms</option>
          <option value="1">At least 1 room</option>
          <option value="3">At least 3 rooms</option>
          <option value="5">At least 5 rooms</option>
        </Select>
        <Button>{filtered.length} matches</Button>
      </Card>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((lodge) => <LodgeCard key={lodge.id} lodge={lodge} />)}
      </div>
    </main>
  );
}

// Detail page handles contact, messaging, reporting, and the "I Got This Lodge" flow.
function LodgeDetailsPage({
  lodges,
  currentUser,
  threads,
  onSendMessage,
  onSubmitReport,
  onGotLodge
}: {
  lodges: Lodge[];
  currentUser: AppUser | null;
  threads: PlatformMessage[];
  onSendMessage: (lodge: Lodge, sender: AppUser, body: string) => void;
  onSubmitReport: (lodge: Lodge, reporter: AppUser, reason: string) => PlatformReport;
  onGotLodge: (lodge: Lodge) => { ok: boolean; message: string };
}) {
  const { id } = useParams();
  const lodge = lodges.find((item) => item.id === id) ?? lodges[0];
  const [dealMessage, setDealMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const currentThread = threads.find((thread) => thread.lodgeId === lodge.id && thread.studentEmail === currentUser?.email);

  function handleGotThisLodge() {
    const result = onGotLodge(lodge);
    setDealMessage(result.message);
  }

  function handleReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentUser) onSubmitReport(lodge, currentUser, reportReason);
    setReportMessage(`Report submitted for ${lodge.title}. Admin has been notified.`);
    setReportReason("");
    setReportOpen(false);
  }

  function handleChatSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatText.trim()) return;
    if (currentUser) onSendMessage(lodge, currentUser, chatText);
    setChatText("");
  }

  return (
    <main className="page-shell py-10">
      <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
        <img className="h-[430px] w-full rounded-lg object-cover" src={lodge.images[0]} alt={lodge.title} />
        <div className="grid gap-3">
          {lodge.images.slice(1, 3).map((image) => (
            <img key={image} className="h-[208px] w-full rounded-lg object-cover" src={image} alt={`${lodge.title} room`} />
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{lodge.type}</Badge>
            {lodge.verified ? <Badge className="bg-primary text-primary-foreground">Verified agent</Badge> : <Badge>Verification pending</Badge>}
            <Badge className="bg-accent text-accent-foreground">{lodge.distanceKm}km to UNIZIK</Badge>
          </div>
          <h1 className="mt-4 text-4xl font-black">{lodge.title}</h1>
          <p className="mt-2 flex items-center gap-1 text-muted-foreground"><MapPin size={17} /> {lodge.location}</p>
          <p className="mt-6 text-lg text-muted-foreground">{lodge.description}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {lodge.amenities.map((amenity) => (
              <div key={amenity} className="flex items-center gap-3 rounded-md border border-border p-3 font-semibold">
                <CheckCircle2 className="text-primary" size={18} /> {amenity}
              </div>
            ))}
          </div>
        </section>
        <Card className="h-fit p-5">
          <p className="text-3xl font-black text-primary">{currency(lodge.price)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Annual rent, agent terms may apply.</p>
          <div className="mt-5 grid gap-3">
            <a href={`tel:${lodge.phone}`}><Button className="w-full"><Phone size={18} /> Call agent</Button></a>
            <a href={lodge.whatsapp}><Button variant="secondary" className="w-full"><MessageCircle size={18} /> WhatsApp</Button></a>
            <Button variant="secondary" className="w-full" onClick={() => setChatOpen((value) => !value)}><MessageCircle size={18} /> In-site chat</Button>
            <Button onClick={handleGotThisLodge} className="w-full bg-accent text-accent-foreground hover:bg-accent"><CheckCircle2 size={18} /> I Got This Lodge</Button>
            <Button variant="danger" className="w-full" onClick={() => setReportOpen((value) => !value)}><Flag size={18} /> Report fake lodge</Button>
          </div>
          {dealMessage ? <p className="mt-4 rounded-md bg-secondary p-3 text-sm font-semibold text-primary">{dealMessage}</p> : null}
          {reportOpen ? (
            <form className="mt-4 grid gap-3 rounded-md border border-border bg-background p-3" onSubmit={handleReport}>
              <textarea
                className="min-h-24 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="Tell us why this lodge looks fake or unsafe"
                minLength={10}
                required
              />
              <Button type="submit" variant="danger">Submit report</Button>
            </form>
          ) : null}
          {reportMessage ? <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">{reportMessage}</p> : null}
          <div className="mt-5 rounded-md bg-secondary p-4 text-sm">
            <p className="font-bold">Posted by: {lodge.agent}</p>
            <p className="mt-1 font-semibold">{lodge.phone}</p>
            <p className="mt-1 text-muted-foreground">{lodge.verified ? "Verified poster" : "Poster verification pending"}</p>
            <p className="mt-1 text-muted-foreground">Deal confirmation records the claim after agent approval.</p>
          </div>
          {chatOpen ? (
            <Card className="mt-4 p-4">
              <h3 className="font-black">Chat with {lodge.agent}</h3>
              <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto rounded-md bg-background p-3 text-sm">
                {(currentThread?.messages ?? [{ senderName: lodge.agent, senderEmail: "agent", body: `Hi, I posted ${lodge.title}. Ask me anything about the room, inspection, or payment terms.`, createdAt: "" }]).map((message, index) => (
                  <div key={`${message.senderName}-${index}`} className={cn("rounded-md p-3", message.senderName === lodge.agent ? "bg-secondary" : "bg-primary text-primary-foreground")}>
                    <p className="text-xs font-black">{message.senderName}</p>
                    <p className="mt-1">{message.body}</p>
                  </div>
                ))}
              </div>
              <form className="mt-3 grid gap-2" onSubmit={handleChatSubmit}>
                <Input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder={`Message ${lodge.agent}`} required />
                <Button type="submit"><MessageCircle size={18} /> Send chat</Button>
              </form>
            </Card>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

// Shared dashboard frame for student, agent, and admin views.
function DashboardShell({
  title,
  role,
  children,
  activeTab = "Overview",
  onTabChange,
  tabs = ["Overview", "Listings", "Messages", "Reports", "Settings"]
}: {
  title: string;
  role: string;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: string[];
}) {
  return (
    <main className="page-shell grid gap-6 py-10 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-lg border border-border bg-card p-3">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => onTabChange?.(item)}
            className={cn("mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold", activeTab === item ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary")}
          >
            <LayoutDashboard size={17} /> {item}
          </button>
        ))}
      </aside>
      <section>
        <Badge>{role}</Badge>
        <h1 className="mt-3 text-4xl font-black">{title}</h1>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

// Student dashboard shows saved activity, messages, notifications, and transactions.
function StudentDashboard({
  currentUser,
  lodges,
  transactions,
  threads,
  notifications,
  onSendMessage
}: {
  currentUser: AppUser | null;
  lodges: Lodge[];
  transactions: LodgeTransaction[];
  threads: PlatformMessage[];
  notifications: PlatformNotification[];
  onSendMessage: (lodge: Lodge, sender: AppUser, body: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("Overview");
  const profileKey = `zik_lodge_student_profile_${currentUser?.email ?? "guest"}`;
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(profileKey);
      if (stored) return JSON.parse(stored) as Record<string, string>;
    } catch {
      // Keep defaults if saved data is unavailable.
    }
    return {
      fullName: currentUser?.name ?? "",
      email: currentUser?.email ?? "",
      phone: "",
      gender: "",
      institution: "UNIZIK",
      faculty: "",
      department: "",
      level: "100",
      matricNumber: "",
      minBudget: "100000",
      maxBudget: "300000",
      preferredAreas: "Ifite, Temp Site, School Gate",
      lodgeType: "Self-contained",
      whatsapp: "",
      notifications: "Email"
    };
  });
  const [reportText, setReportText] = useState("");
  const [studentReports, setStudentReports] = useState<string[]>([]);
  const [studentMessage, setStudentMessage] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const myTransactions = transactions.filter((transaction) => transaction.studentEmail === currentUser?.email);
  const myThreads = threads.filter((thread) => thread.studentEmail === currentUser?.email);
  const selectedThread = myThreads.find((thread) => thread.id === selectedThreadId) ?? myThreads[0];
  const studentNotifications = notifications.filter((notification) => notification.audience === "student" && (!notification.target || notification.target === currentUser?.email));

  useEffect(() => {
    localStorage.setItem(profileKey, JSON.stringify(profile));
  }, [profile, profileKey]);

  function updateProfile(field: string, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <DashboardShell title="Student dashboard" role="Student" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "Overview" ? (
        <>
          <Stats stats={[["Favorite lodges", 3], ["Notifications", studentNotifications.length], ["Reports sent", studentReports.length], ["Got lodge history", myTransactions.length]]} />
          {studentNotifications.length ? (
            <Card className="mt-6 p-5">
              <h2 className="text-2xl font-black">Notifications</h2>
              <div className="mt-3 grid gap-2">
                {studentNotifications.map((notification) => <p key={notification.id} className="rounded-md bg-secondary p-3 text-sm"><strong>{notification.title}:</strong> {notification.body}</p>)}
              </div>
            </Card>
          ) : null}
          <Card className="mt-6 p-5">
            <h2 className="text-2xl font-black">Transaction status tracker</h2>
            <Table
              rows={(myTransactions.length ? myTransactions : [{ id: "none", lodgeTitle: "No lodge claims yet", agentName: "-", commissionAmount: 0, status: "pending_confirmation" as const }]).map((transaction) => [
                transaction.lodgeTitle,
                transaction.agentName,
                transaction.status,
                transaction.id === "none" ? "-" : currency(transaction.commissionAmount)
              ])}
              headers={["Lodge", "Agent", "Status", "Fee"]}
            />
          </Card>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {lodges.slice(0, 2).map((lodge) => <LodgeCard key={lodge.id} lodge={lodge} />)}
          </div>
        </>
      ) : null}
      {activeTab === "Listings" ? (
        <div className="grid gap-5">
          <Card className="p-5">
            <h2 className="text-2xl font-black">Saved and recently viewed lodges</h2>
            <p className="mt-2 text-muted-foreground">These records are saved to your own student profile on this device.</p>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {lodges.slice(0, 4).map((lodge) => <LodgeCard key={lodge.id} lodge={lodge} />)}
          </div>
        </div>
      ) : null}
      {activeTab === "Messages" ? (
        <Card className="p-5">
          <h2 className="text-2xl font-black">Messages</h2>
          <Select value={selectedThread?.id ?? ""} onChange={(event) => setSelectedThreadId(event.target.value)} className="mt-4">
            <option value="">Select a lodge conversation</option>
            {myThreads.map((thread) => <option key={thread.id} value={thread.id}>{thread.lodgeTitle} with {thread.agentName}</option>)}
          </Select>
          <div className="mt-4 grid gap-3 rounded-md bg-background p-4">
            {selectedThread ? selectedThread.messages.map((chat, index) => (
              <div key={`${chat.senderEmail}-${index}`} className="rounded-md border border-border p-3">
                <p className="text-xs font-black text-primary">{chat.senderName}</p>
                <p className="mt-1">{chat.body}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No messages yet. Start from a lodge detail page.</p>}
          </div>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!studentMessage.trim() || !selectedThread || !currentUser) return;
              const lodge = lodges.find((item) => item.id === selectedThread.lodgeId);
              if (lodge) onSendMessage(lodge, currentUser, studentMessage);
              setStudentMessage("");
            }}
          >
            <Input value={studentMessage} onChange={(event) => setStudentMessage(event.target.value)} placeholder="Message an agent about a lodge" required />
            <Button type="submit"><MessageCircle size={18} /> Send message</Button>
          </form>
        </Card>
      ) : null}
      {activeTab === "Reports" ? (
        <Card className="p-5">
          <h2 className="text-2xl font-black">Report center</h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!reportText.trim()) return;
              setStudentReports((items) => [reportText, ...items]);
              setReportText("");
            }}
          >
            <textarea className="min-h-28 rounded-md border border-input bg-background p-3 outline-none focus:ring-2 focus:ring-ring" value={reportText} onChange={(event) => setReportText(event.target.value)} placeholder="Report a fake lodge, fake agent, payment issue, or safety concern" required />
            <Button type="submit" variant="danger"><Flag size={18} /> Submit report</Button>
          </form>
          <div className="mt-4 grid gap-2">
            {studentReports.map((report, index) => <p key={`${report}-${index}`} className="rounded-md bg-secondary p-3 text-sm">{report}</p>)}
          </div>
        </Card>
      ) : null}
      {activeTab === "Settings" ? (
        <Card className="p-5">
          <h2 className="text-2xl font-black">Private student profile</h2>
          <p className="mt-2 text-muted-foreground">Only you can see and edit these details from your account.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input value={profile.fullName} onChange={(event) => updateProfile("fullName", event.target.value)} placeholder="Full name" />
            <Input value={profile.email} onChange={(event) => updateProfile("email", event.target.value)} placeholder="Email address" type="email" />
            <Input value={profile.phone} onChange={(event) => updateProfile("phone", cleanElevenDigitPhone(event.target.value))} placeholder="Phone number: 08012345678" type="tel" inputMode="numeric" minLength={11} maxLength={11} />
            <Input value={profile.whatsapp} onChange={(event) => updateProfile("whatsapp", cleanElevenDigitPhone(event.target.value))} placeholder="WhatsApp number for agent contact" type="tel" inputMode="numeric" minLength={11} maxLength={11} />
            <Input value={profile.gender} onChange={(event) => updateProfile("gender", event.target.value)} placeholder="Gender optional" />
            <Input value={profile.institution} onChange={(event) => updateProfile("institution", event.target.value)} placeholder="Institution" />
            <Input value={profile.faculty} onChange={(event) => updateProfile("faculty", event.target.value)} placeholder="Faculty" />
            <Input value={profile.department} onChange={(event) => updateProfile("department", event.target.value)} placeholder="Department" />
            <Select value={profile.level} onChange={(event) => updateProfile("level", event.target.value)}>
              <option>100</option>
              <option>200</option>
              <option>300</option>
              <option>400</option>
              <option>500</option>
            </Select>
            <Input value={profile.matricNumber} onChange={(event) => updateProfile("matricNumber", event.target.value)} placeholder="Matric number optional" />
            <Input value={profile.minBudget} onChange={(event) => updateProfile("minBudget", event.target.value)} placeholder="Minimum budget e.g. 100000" />
            <Input value={profile.maxBudget} onChange={(event) => updateProfile("maxBudget", event.target.value)} placeholder="Maximum budget e.g. 300000" />
            <Input value={profile.preferredAreas} onChange={(event) => updateProfile("preferredAreas", event.target.value)} placeholder="Preferred areas: Ifite, Temp Site, School Gate" />
            <Select value={profile.lodgeType} onChange={(event) => updateProfile("lodgeType", event.target.value)}>
              <option>Self-contained</option>
              <option>Shared room</option>
              <option>Hostel</option>
              <option>Single room</option>
            </Select>
            <Select value={profile.notifications} onChange={(event) => updateProfile("notifications", event.target.value)}>
              <option>Email</option>
              <option>Push later</option>
              <option>SMS later</option>
            </Select>
          </div>
          <p className="mt-4 rounded-md bg-secondary p-3 text-sm font-semibold text-primary">Profile saved automatically.</p>
        </Card>
      ) : null}
    </DashboardShell>
  );
}

// Agent dashboard manages verification state, listings, messages, and deal confirmation.
function AgentDashboard({
  currentUser,
  lodges,
  transactions,
  threads,
  notifications,
  onAddLodge,
  onVerify,
  onSendMessage,
  onSendThreadReply,
  onTransactionStatus
}: {
  currentUser: AppUser | null;
  lodges: Lodge[];
  transactions: LodgeTransaction[];
  threads: PlatformMessage[];
  notifications: PlatformNotification[];
  onAddLodge: (lodge: Lodge) => void;
  onVerify: (email: string) => void;
  onSendMessage: (lodge: Lodge, sender: AppUser, body: string) => void;
  onSendThreadReply: (threadId: string, sender: AppUser, body: string) => void;
  onTransactionStatus: (id: string, status: TransactionStatus) => void;
}) {
  const [activeTab, setActiveTab] = useState("Overview");
  const agentProfileKey = `zik_lodge_agent_profile_${currentUser?.email ?? "guest"}`;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [agentMessage, setAgentMessage] = useState("");
  const [selectedAgentThreadId, setSelectedAgentThreadId] = useState("");
  const [agentReports, setAgentReports] = useState<string[]>([]);
  const [agentReportText, setAgentReportText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [verificationForm, setVerificationForm] = useState({
    fullName: currentUser?.name ?? "",
    businessName: "",
    email: currentUser?.email ?? "",
    nin: "",
    phone: currentUser?.phone ? cleanElevenDigitPhone(currentUser.phone) : "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    idDocument: "",
    selfie: "",
    status: currentUser?.verified ? "verified" : "unverified",
    rejectionReason: ""
  });
  const [form, setForm] = useState({
    agentName: currentUser?.name ?? "Adaeze Okafor",
    phone: currentUser?.phone ? cleanElevenDigitPhone(currentUser.phone) : "",
    title: "",
    location: "Ifite, Awka",
    price: "",
    type: "Self-contained" as Lodge["type"],
    distanceKm: "",
    availableRooms: "",
    description: "",
    amenities: "Water, Security, Prepaid meter"
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(agentProfileKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { form?: typeof form; verificationForm?: typeof verificationForm };
      if (parsed.form) setForm((current) => ({ ...current, ...parsed.form }));
      if (parsed.verificationForm) setVerificationForm((current) => ({ ...current, ...parsed.verificationForm }));
    } catch {
      // Keep defaults if profile storage cannot be read.
    }
  }, [agentProfileKey]);

  useEffect(() => {
    localStorage.setItem(agentProfileKey, JSON.stringify({ form, verificationForm }));
  }, [agentProfileKey, form, verificationForm]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVerificationForm(field: keyof typeof verificationForm, value: string) {
    setVerificationForm((current) => ({ ...current, [field]: value }));
  }

  const agentLodges = lodges.filter((lodge) => lodge.agent === form.agentName || lodge.agent === currentUser?.name);
  const isVerified = Boolean(currentUser?.verified);
  const agentTransactions = transactions.filter((transaction) => transaction.agentName === form.agentName || transaction.agentName === currentUser?.name);
  const agentThreads = threads.filter((thread) => thread.agentName === form.agentName || thread.agentName === currentUser?.name);
  const selectedAgentThread = agentThreads.find((thread) => thread.id === selectedAgentThreadId) ?? agentThreads[0];
  const agentNotifications = notifications.filter((notification) => notification.audience === "agent" && (!notification.target || notification.target === form.agentName || notification.target === currentUser?.name));
  const confirmedTransactions = agentTransactions.filter((transaction) => transaction.status === "confirmed");
  const pendingTransactions = agentTransactions.filter((transaction) => transaction.status === "pending_confirmation");
  const walletBalance = confirmedTransactions.reduce((sum, transaction) => sum + transaction.commissionAmount, 0);

  async function handleImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    setUploadError("");

    if (!files.length) {
      setSelectedImages([]);
      return;
    }

    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversized) {
      setUploadError("Each image must be 5MB or smaller.");
      return;
    }

    const imageUrls = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Could not read image"));
            reader.readAsDataURL(file);
          })
      )
    );

    setSelectedImages(imageUrls);
  }

  function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    setUploadMessage("");
    setUploading(true);

    if (!selectedImages.length) {
      setUploadError("Please add at least one lodge image.");
      setUploading(false);
      return;
    }
    if (!isValidElevenDigitPhone(form.phone)) {
      setUploadError("Agent phone number must be exactly 11 digits and start with 0.");
      setUploading(false);
      return;
    }

    const titleSlug = form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const newLodge: Lodge = {
      id: `${titleSlug || "agent-lodge"}-${Date.now()}`,
      title: form.title,
      location: form.location,
      university: "Nnamdi Azikiwe University",
      price: Number(form.price),
      type: form.type,
      distanceKm: Number(form.distanceKm),
      availableRooms: Number(form.availableRooms),
      status: "pending",
      verified: false,
      featured: true,
      rating: 4.6,
      agent: form.agentName,
      phone: form.phone,
      whatsapp: whatsappLink(form.phone),
      description: form.description,
      amenities: form.amenities.split(",").map((item) => item.trim()).filter(Boolean),
      images: selectedImages
    };

    onAddLodge(newLodge);
    setUploadMessage("Lodge submitted. Admin must approve it before students see it.");
    setForm({
      agentName: form.agentName,
      phone: form.phone,
      title: "",
      location: "Ifite, Awka",
      price: "",
      type: "Self-contained",
      distanceKm: "",
      availableRooms: "",
      description: "",
      amenities: "Water, Security, Prepaid meter"
    });
    setSelectedImages([]);
    setUploading(false);
  }

  return (
    <DashboardShell title="Agent dashboard" role="Agent" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "Overview" ? (
        <>
          <Stats stats={[["My listings", agentLodges.length], ["Pending claims", pendingTransactions.length], ["Notifications", agentNotifications.length], ["Fees", currency(walletBalance)]]} />
          {agentNotifications.length ? (
            <Card className="mt-6 p-5">
              <h2 className="text-2xl font-black">Agent notifications</h2>
              <div className="mt-3 grid gap-2">
                {agentNotifications.map((notification) => <p key={notification.id} className="rounded-md bg-secondary p-3 text-sm"><strong>{notification.title}:</strong> {notification.body}</p>)}
              </div>
            </Card>
          ) : null}
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-2xl font-black">Agent profile</h2>
              <p className="mt-3 text-sm text-muted-foreground">Students see these details on every lodge you post.</p>
              <div className="mt-4 grid gap-3">
                <Input value={form.agentName} onChange={(event) => updateForm("agentName", event.target.value)} placeholder="Full name" />
                <Input value={verificationForm.businessName} onChange={(event) => updateVerificationForm("businessName", event.target.value)} placeholder="Business name e.g. Ejike Properties" />
                <Input value={form.phone} onChange={(event) => updateForm("phone", cleanElevenDigitPhone(event.target.value))} placeholder="Phone / WhatsApp: 08012345678" type="tel" inputMode="numeric" minLength={11} maxLength={11} />
                <Badge className="w-fit bg-accent text-accent-foreground">Listings need admin approval</Badge>
              </div>
            </Card>
            <Card className="p-5 xl:col-span-2">
              <h2 className="text-2xl font-black">Incoming lodge claims</h2>
              <p className="mt-2 text-muted-foreground">Only verified agents can confirm or reject successful lodge transactions.</p>
              <div className="mt-4 grid gap-3">
                {agentTransactions.length ? agentTransactions.map((transaction) => (
                  <div key={transaction.id} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="font-black">{transaction.lodgeTitle}</p>
                      <p className="text-sm text-muted-foreground">{transaction.studentName} · {currency(transaction.amountPaid)} · {transaction.status}</p>
                      <p className="text-sm font-semibold text-primary">Fee: {currency(transaction.commissionAmount)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!isVerified || transaction.status !== "pending_confirmation"} onClick={() => onTransactionStatus(transaction.id, "confirmed")}>Confirm</Button>
                      <Button disabled={!isVerified || transaction.status !== "pending_confirmation"} variant="danger" onClick={() => onTransactionStatus(transaction.id, "rejected")}>Reject</Button>
                    </div>
                  </div>
                )) : <p className="rounded-md bg-secondary p-3 text-sm">No student claims yet.</p>}
              </div>
            </Card>
          </div>
        </>
      ) : null}
      {activeTab === "Listings" ? (
      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Listing manager</h2>
          <Button onClick={() => setUploadOpen((value) => !value)}><Upload size={18} /> {uploadOpen ? "Close form" : "Upload lodge"}</Button>
        </div>
        {uploadOpen ? (
          <form className="mt-5 grid gap-4 rounded-lg border border-border bg-background p-4" onSubmit={handleUploadSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={form.agentName} onChange={(event) => updateForm("agentName", event.target.value)} placeholder="Agent name" required />
              <Input value={form.phone} onChange={(event) => updateForm("phone", cleanElevenDigitPhone(event.target.value))} placeholder="Agent phone / WhatsApp: 08012345678" type="tel" inputMode="numeric" minLength={11} maxLength={11} required />
              <Input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Lodge name" required />
              <Input value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="Location" required />
              <Input value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="Annual price, e.g. 450000" type="number" min="1" required />
              <Select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
                <option>Self-contained</option>
                <option>Single room</option>
                <option>Flat</option>
                <option>Shared apartment</option>
              </Select>
              <Input value={form.distanceKm} onChange={(event) => updateForm("distanceKm", event.target.value)} placeholder="Distance from school in km" type="number" min="0" step="0.1" required />
              <Input value={form.availableRooms} onChange={(event) => updateForm("availableRooms", event.target.value)} placeholder="Available rooms" type="number" min="0" required />
            </div>
            <textarea
              className="min-h-28 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder="Describe the room, water, light, security, and payment terms"
              required
            />
            <Input value={form.amenities} onChange={(event) => updateForm("amenities", event.target.value)} placeholder="Amenities separated by comma" />
            <label className="grid gap-2 rounded-md border border-dashed border-border bg-card p-4 text-sm font-semibold">
              Upload lodge images
              <input className="text-sm" type="file" accept="image/*" multiple onChange={handleImageSelection} required />
              <span className="text-xs text-muted-foreground">Add up to 6 images. First image becomes the listing cover.</span>
            </label>
            {selectedImages.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {selectedImages.map((image, index) => (
                  <img key={image} className="h-32 w-full rounded-md object-cover" src={image} alt={`Selected lodge ${index + 1}`} />
                ))}
              </div>
            ) : null}
            {uploadError ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">{uploadError}</p> : null}
            {uploadMessage ? <p className="rounded-md bg-secondary p-3 text-sm font-semibold text-primary">{uploadMessage}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Submit lodge"}</Button>
              <Link to="/lodges"><Button type="button" variant="secondary">View listings</Button></Link>
            </div>
          </form>
        ) : null}
        <Table rows={agentLodges.map((lodge) => [lodge.title, lodge.location, lodge.status, currency(lodge.price)])} headers={["Lodge", "Location", "Status", "Price"]} />
      </Card>
      ) : null}
      {activeTab === "Messages" ? (
        <Card className="p-5">
          <h2 className="text-2xl font-black">Student messages</h2>
          <Select value={selectedAgentThread?.id ?? ""} onChange={(event) => setSelectedAgentThreadId(event.target.value)} className="mt-4">
            <option value="">Select a student conversation</option>
            {agentThreads.map((thread) => <option key={thread.id} value={thread.id}>{thread.studentName} about {thread.lodgeTitle}</option>)}
          </Select>
          <div className="mt-4 grid gap-3 rounded-md bg-background p-4">
            {selectedAgentThread ? selectedAgentThread.messages.map((chat, index) => (
              <div key={`${chat.senderEmail}-${index}`} className="rounded-md border border-border p-3">
                <p className="text-xs font-black text-primary">{chat.senderName}</p>
                <p className="mt-1">{chat.body}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No student messages yet.</p>}
          </div>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!agentMessage.trim() || !selectedAgentThread || !currentUser) return;
              onSendThreadReply(selectedAgentThread.id, currentUser, agentMessage);
              setAgentMessage("");
            }}
          >
            <Input value={agentMessage} onChange={(event) => setAgentMessage(event.target.value)} placeholder="Reply to student message" required />
            <Button type="submit"><MessageCircle size={18} /> Send reply</Button>
          </form>
        </Card>
      ) : null}
      {activeTab === "Reports" ? (
        <Card className="p-5">
          <h2 className="text-2xl font-black">Agent report room</h2>
          <p className="mt-2 text-muted-foreground">Report fake students, payment issues, duplicate posts, or listing disputes.</p>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!agentReportText.trim()) return;
              setAgentReports((items) => [agentReportText, ...items]);
              setAgentReportText("");
            }}
          >
            <textarea className="min-h-28 rounded-md border border-input bg-background p-3 outline-none focus:ring-2 focus:ring-ring" value={agentReportText} onChange={(event) => setAgentReportText(event.target.value)} placeholder="Lay your report here" required />
            <Button type="submit" variant="danger"><Flag size={18} /> Submit report</Button>
          </form>
          <div className="mt-4 grid gap-2">
            {agentReports.map((report, index) => <p key={`${report}-${index}`} className="rounded-md bg-secondary p-3 text-sm">{report}</p>)}
          </div>
        </Card>
      ) : null}
      {activeTab === "Settings" ? (
        <Card className="p-5">
          <h2 className="text-2xl font-black">Agent verification settings</h2>
          <p className="mt-2 text-muted-foreground">Your sensitive verification details stay on your own profile view. Admin only sees high-level approval status in this demo.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input value={verificationForm.fullName} onChange={(event) => updateVerificationForm("fullName", event.target.value)} placeholder="Full name" />
            <Input value={verificationForm.businessName} onChange={(event) => updateVerificationForm("businessName", event.target.value)} placeholder="Business name e.g. Ejike Properties" />
            <Input value={verificationForm.email} onChange={(event) => updateVerificationForm("email", event.target.value)} placeholder="Email" type="email" />
            <Input value={verificationForm.phone} onChange={(event) => updateVerificationForm("phone", cleanElevenDigitPhone(event.target.value))} placeholder="Phone number: 08012345678" type="tel" inputMode="numeric" minLength={11} maxLength={11} />
            <Input value={verificationForm.bankName} onChange={(event) => updateVerificationForm("bankName", event.target.value)} placeholder="Bank name" />
            <Input value={verificationForm.accountNumber} onChange={(event) => updateVerificationForm("accountNumber", event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Account number" inputMode="numeric" />
            <Input value={verificationForm.accountName} onChange={(event) => updateVerificationForm("accountName", event.target.value)} placeholder="Account name" />
            <label className="grid gap-2 rounded-md border border-dashed border-border p-4 text-sm font-semibold">
              Government ID document
              <input type="file" accept="image/*,.pdf" onChange={(event) => updateVerificationForm("idDocument", event.target.files?.[0]?.name ?? "")} />
              <span className="text-xs text-muted-foreground">{verificationForm.idDocument || "Driver's license, voter card, or other government ID"}</span>
            </label>
            <label className="grid gap-2 rounded-md border border-dashed border-border p-4 text-sm font-semibold">
              Selfie holding ID optional
              <input type="file" accept="image/*" onChange={(event) => updateVerificationForm("selfie", event.target.files?.[0]?.name ?? "")} />
              <span className="text-xs text-muted-foreground">{verificationForm.selfie || "Optional selfie upload"}</span>
            </label>
          </div>
          <Button
            className="mt-5"
            onClick={() => {
              if (!isValidEmailAddress(verificationForm.email)) {
                setVerificationMessage("Enter a valid email address before submission.");
                return;
              }
              if (!isValidElevenDigitPhone(verificationForm.phone)) {
                setVerificationMessage("Phone number must be exactly 11 digits and start with 0.");
                return;
              }
              setVerificationForm((current) => ({ ...current, status: "pending_review" }));
              setVerificationMessage("Verification submitted for admin review.");
            }}
          >
            <ShieldCheck size={18} /> Submit verification form
          </Button>
          {verificationMessage ? <p className="mt-3 rounded-md bg-secondary p-3 text-sm font-semibold text-primary">{verificationMessage}</p> : null}
        </Card>
      ) : null}
    </DashboardShell>
  );
}

// Admin dashboard centralizes moderation, users, reports, verification, transactions, and audits.
function AdminDashboard({
  members,
  lodges,
  transactions,
  reportsInbox,
  notifications,
  auditLogs,
  commissionSettings,
  onCommissionSettingsChange,
  onTransactionStatus,
  onApproveAgent,
  onRejectAgent,
  onMemberStatus
}: {
  members: AppUser[];
  lodges: Lodge[];
  transactions: LodgeTransaction[];
  reportsInbox: PlatformReport[];
  notifications: PlatformNotification[];
  auditLogs: PlatformAudit[];
  commissionSettings: CommissionSettings;
  onCommissionSettingsChange: (settings: CommissionSettings) => void;
  onTransactionStatus: (id: string, status: TransactionStatus) => void;
  onApproveAgent: (email: string) => void;
  onRejectAgent: (email: string) => void;
  onMemberStatus: (email: string, status: AppUser["accountStatus"]) => void;
}) {
  const pendingAgents = members.filter((member) => member.role === "agent" && !member.verified);
  const studentAccounts = members.filter((member) => member.role === "student");
  const agentAccounts = members.filter((member) => member.role === "agent");
  const confirmedRevenue = transactions.filter((transaction) => transaction.status === "confirmed").reduce((sum, transaction) => sum + transaction.commissionAmount, 0);
  const adminNotifications = notifications.filter((notification) => notification.audience === "admin");
  const [activeTab, setActiveTab] = useState("Overview");
  const [rejectReason, setRejectReason] = useState("");
  const [previewAgent, setPreviewAgent] = useState<AppUser | null>(null);
  const statusClass = (status: AppUser["accountStatus"]) =>
    status === "restricted" ? "bg-destructive text-destructive-foreground" : status === "pending" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground";
  const accountCard = (member: AppUser) => (
    <div key={member.email} className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{member.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
          <p className="text-sm text-muted-foreground">{member.phone ?? "No phone number saved"}</p>
        </div>
        <Badge className={statusClass(member.accountStatus ?? "active")}>{member.accountStatus ?? "active"}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{member.role}</Badge>
        <Badge className={member.verified ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}>{member.verified ? "Verified" : "Pending verification"}</Badge>
        {member.securityVerified === false ? <Badge className="bg-destructive text-destructive-foreground">Security mismatch</Badge> : <Badge>Security OK</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {member.role === "agent" && !member.verified ? <Button onClick={() => onApproveAgent(member.email)}>Verify</Button> : null}
        <Button variant="secondary" onClick={() => onMemberStatus(member.email, "pending")}>Pending</Button>
        <Button variant="secondary" onClick={() => onMemberStatus(member.email, "active")}>Active</Button>
        <Button variant="danger" onClick={() => onMemberStatus(member.email, "restricted")}>Restrict</Button>
      </div>
    </div>
  );
  return (
    <DashboardShell title="Admin dashboard" role="Admin" activeTab={activeTab} onTabChange={setActiveTab} tabs={["Overview", "Accounts", "Verification", "Reports", "Notifications", "Transactions", "Audit"]}>
      <Stats stats={[["Students", studentAccounts.length], ["Agents", agentAccounts.length], ["Admin notifications", adminNotifications.length], ["Platform revenue", currency(confirmedRevenue)]]} />
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {activeTab === "Overview" ? <Card className="p-5">
          <h2 className="text-2xl font-black">Verification payments</h2>
          <div className="mt-4 rounded-md bg-secondary p-4 text-sm">
            <p className="font-black">All verification payments go to:</p>
            <p className="mt-2">Bank: FirstBank</p>
            <p>Account number: 3159371980</p>
          </div>
          <p className="mt-4 rounded-md bg-background p-3 text-sm text-muted-foreground">Commission tracking is disabled for now.</p>
          <Table rows={transactions.map((transaction) => [transaction.id, transaction.agentName, currency(transaction.commissionAmount), transaction.status])} headers={["Transaction", "Agent", "Fee", "Status"]} />
        </Card> : null}
        {activeTab === "Reports" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Reports and moderation</h2>
          <Table rows={[...reportsInbox.map((report) => [report.id, report.lodgeTitle, report.status, report.reason]), ...reports.map((report) => [report.id, report.lodge, report.status, report.reason])]} headers={["ID", "Lodge", "Status", "Reason"]} />
        </Card> : null}
        {activeTab === "Notifications" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Notification room</h2>
          <div className="mt-4 grid gap-3">
            {adminNotifications.length ? adminNotifications.map((notification) => (
              <div key={notification.id} className="rounded-md border border-border bg-background p-4">
                <p className="font-black">{notification.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                <p className="mt-2 text-xs font-semibold text-primary">{notification.createdAt}</p>
              </div>
            )) : <p className="rounded-md bg-secondary p-3 text-sm">No admin notifications yet.</p>}
          </div>
        </Card> : null}
        {activeTab === "Verification" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Pending agent verification</h2>
          <div className="mt-4 grid gap-3">
            {pendingAgents.length ? pendingAgents.map((agent) => (
              <div key={agent.email} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-black">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">{agent.email}</p>
                  <Badge className="mt-2 bg-accent text-accent-foreground">pending_review</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setPreviewAgent(agent)}>Preview documents</Button>
                  <Button onClick={() => onApproveAgent(agent.email)}>Approve</Button>
                  <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reject reason" />
                  <Button variant="danger" onClick={() => { onRejectAgent(agent.email); setRejectReason(""); }}>Reject</Button>
                </div>
              </div>
            )) : <p className="rounded-md bg-secondary p-3 text-sm">No pending agents.</p>}
          </div>
          {previewAgent ? (
            <div className="mt-4 rounded-lg border border-border bg-background p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-black">Document preview: {previewAgent.name}</h3>
                <Button variant="secondary" onClick={() => setPreviewAgent(null)}>Close preview</Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-dashed border-border p-4">
                  <p className="font-bold">Government ID document</p>
                  {previewAgent.ninDocumentUrl ? <img className="mt-3 h-48 w-full rounded-md object-cover" src={previewAgent.ninDocumentUrl} alt="Uploaded identity document" /> : <p className="mt-2 text-sm text-muted-foreground">No identity document uploaded in this demo profile.</p>}
                </div>
                <div className="rounded-md border border-dashed border-border p-4">
                  <p className="font-bold">Agent image</p>
                  {previewAgent.photoUrl || previewAgent.photo ? <img className="mt-3 h-48 w-full rounded-md object-cover" src={previewAgent.photoUrl ?? previewAgent.photo} alt="Agent profile" /> : <p className="mt-2 text-sm text-muted-foreground">No agent image uploaded in this demo profile.</p>}
                </div>
              </div>
            </div>
          ) : null}
        </Card> : null}
        {activeTab === "Transactions" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Transaction monitoring</h2>
          <div className="mt-4 grid gap-3">
            {transactions.length ? transactions.map((transaction) => (
              <div key={transaction.id} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-black">{transaction.lodgeTitle}</p>
                  <p className="text-sm text-muted-foreground">{transaction.studentName} → {transaction.agentName} · {transaction.status}</p>
                  <p className="text-sm font-semibold text-primary">Fee: {currency(transaction.commissionAmount)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={transaction.status !== "pending_confirmation"} onClick={() => onTransactionStatus(transaction.id, "confirmed")}>Force confirm</Button>
                  <Button disabled={transaction.status !== "pending_confirmation"} variant="danger" onClick={() => onTransactionStatus(transaction.id, "rejected")}>Reject</Button>
                </div>
              </div>
            )) : <p className="rounded-md bg-secondary p-3 text-sm">No transactions yet.</p>}
          </div>
        </Card> : null}
        {activeTab === "Audit" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Admin audit log</h2>
          <p className="mt-2 text-sm text-muted-foreground">Security-sensitive actions are recorded here. The backend also stores hash-chained audit events for tamper detection.</p>
          <Table rows={auditLogs.map((event) => [event.createdAt, event.actor, event.action, event.target])} headers={["Time", "Actor", "Action", "Target"]} />
        </Card> : null}
        {activeTab === "Accounts" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Account control room</h2>
          <div className="mt-4 grid gap-5 xl:grid-cols-2">
            <div>
              <h3 className="text-lg font-black">Students</h3>
              <div className="mt-3 grid gap-3">{studentAccounts.length ? studentAccounts.map(accountCard) : <p className="rounded-md bg-secondary p-3 text-sm">No student accounts yet.</p>}</div>
            </div>
            <div>
              <h3 className="text-lg font-black">Agents</h3>
              <div className="mt-3 grid gap-3">{agentAccounts.length ? agentAccounts.map(accountCard) : <p className="rounded-md bg-secondary p-3 text-sm">No agent accounts yet.</p>}</div>
            </div>
          </div>
        </Card> : null}
        {activeTab === "Overview" ? <Card className="p-5 xl:col-span-2">
          <h2 className="text-2xl font-black">Listing ownership</h2>
          <Table rows={lodges.map((lodge) => [lodge.title, lodge.agent, lodge.phone, lodge.verified ? "verified" : "pending"])} headers={["Lodge", "Posted by", "Contact", "Poster status"]} />
        </Card> : null}
      </div>
    </DashboardShell>
  );
}

// Login/register flow shares one component because most fields and API handling overlap.
function AuthPage({ register = false, onAuth }: { register?: boolean; onAuth: (user: AppUser) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "agent" | "admin">("student");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Invalid email");
      return;
    }
    setEmail(normalizedEmail);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not send OTP");
      setOtpSent(true);
      setDevOtp(data.devOtp ?? "");
      setMessage(data.devOtp ? `OTP sent. Development OTP: ${data.devOtp}` : "OTP sent to your email.");
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) {
    const file = event.target.files?.[0];
    if (!file) return setter("");
    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are allowed here.");
      return;
    }
    if (file.size > profileImageMaxBytes) {
      setError("Profile images must be 2MB or smaller.");
      return;
    }
    setter(await readFileAsDataUrl(file));
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (register && !isValidEmailAddress(normalizedEmail)) throw new Error("Invalid email");
      if (register && !otpSent) throw new Error("Request and enter the email OTP before creating your account.");
      if (register && !isValidElevenDigitPhone(phone)) throw new Error("Phone number must be exactly 11 digits and start with 0.");
      if (register && !photoUrl) {
        throw new Error("Add a profile image before creating your account.");
      }
      setEmail(normalizedEmail);
      const endpoint = register ? "/api/auth/register" : "/api/auth/login";
      const payload = register ? { name, email: normalizedEmail, phone, password, role, otp, photoUrl } : { email: normalizedEmail, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Authentication failed");
      }

      localStorage.setItem("zik_lodge_token", data.token);
      localStorage.setItem("zik_lodge_user", JSON.stringify(data.user));
      onAuth(data.user);
      setMessage(register ? "Account created successfully. Agent accounts stay pending until admin verification." : "Login successful.");

      const dashboard = data.user.role === "admin" ? "/admin" : data.user.role === "agent" ? "/agent" : "/student";
      setTimeout(() => navigate(dashboard), 500);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell grid min-h-[calc(100vh-8rem)] items-center gap-8 py-10 lg:grid-cols-2">
      <section>
        <Badge><Lock size={14} /> Secure access</Badge>
        <h1 className="mt-4 text-4xl font-black md:text-6xl">{register ? "Create your Zik Lodge account" : "Welcome back to Zik Lodge"}</h1>
        <p className="mt-4 text-lg text-muted-foreground">Role-based access for students, agents, and admins with protected dashboards and JWT-ready backend endpoints.</p>
      </section>
      <Card className="p-5">
        <form className="grid gap-4" onSubmit={handleAuth}>
          {register ? (
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" minLength={2} required />
          ) : null}
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" required />
          {register ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Email OTP" inputMode="numeric" maxLength={6} required />
                <Button type="button" variant="secondary" onClick={requestOtp} disabled={loading || !email}>{otpSent ? "Resend OTP" : "Send OTP"}</Button>
              </div>
              {devOtp ? <p className="rounded-md bg-secondary p-3 text-sm font-semibold text-primary">Development OTP: {devOtp}</p> : null}
              <Input value={phone} onChange={(event) => setPhone(cleanElevenDigitPhone(event.target.value))} placeholder="Phone number: 08012345678" type="tel" inputMode="numeric" minLength={11} maxLength={11} required />
            </>
          ) : null}
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" minLength={register ? 8 : 1} required />
          {register ? (
            <Select value={role} onChange={(event) => setRole(event.target.value as "student" | "agent")}>
              <option value="student">Student</option>
              <option value="agent">Agent/Landlord/Subletter</option>
            </Select>
          ) : null}
          {register ? (
            <label className="grid gap-3 rounded-md border border-dashed border-border bg-background p-4 text-sm font-semibold sm:grid-cols-[auto_1fr] sm:items-center">
              <span className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-muted-foreground">
                {photoUrl ? <img className="h-full w-full object-cover" src={photoUrl} alt="Profile preview" /> : <Camera size={32} />}
              </span>
              <span className="grid gap-2">
                <span>Add profile image</span>
                <span className="text-xs font-normal text-muted-foreground">This becomes your round account photo, like WhatsApp or Facebook. Max 2MB.</span>
                <input type="file" accept="image/*" onChange={(event) => handleFileChange(event, setPhotoUrl)} required />
              </span>
            </label>
          ) : null}
          {!register ? <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">Programmer/admin login is restricted to the admin account only.</p> : null}
          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p> : null}
          {message ? <p className="rounded-md bg-secondary p-3 text-sm font-semibold text-primary">{message}</p> : null}
          <Button type="submit" disabled={loading}>{loading ? "Please wait..." : register ? "Create account" : "Login"}</Button>
          {!register ? <Link className="text-center text-sm font-semibold text-primary" to="/forgot-password">Forgot password?</Link> : null}
          <Link className="text-center text-sm font-semibold text-primary" to={register ? "/login" : "/register"}>{register ? "I already have an account" : "Create a new account"}</Link>
        </form>
      </Card>
    </main>
  );
}

// Password recovery requests an OTP and then submits the new password.
function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  async function requestResetOtp() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmailAddress(normalizedEmail)) return setError("Invalid email");
    setEmail(normalizedEmail);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail })
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message ?? "Could not send reset OTP");
    setResetEmail(normalizedEmail);
    setDevOtp(data.devOtp ?? "");
    setMessage(data.devOtp ? `Reset OTP sent to ${normalizedEmail}. Development OTP: ${data.devOtp}` : `Reset OTP sent to ${normalizedEmail}.`);
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!resetEmail || normalizedEmail !== resetEmail) {
      return setError("Use the same email address that received the reset OTP.");
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail, otp, password })
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message ?? "Password reset failed");
    setMessage("Password reset successful. Login with your new password.");
  }

  return (
    <main className="page-shell grid min-h-[calc(100vh-8rem)] items-center py-10">
      <Card className="mx-auto w-full max-w-xl p-5">
        <Badge><Lock size={14} /> Account recovery</Badge>
        <h1 className="mt-4 text-3xl font-black">Reset your password</h1>
        <form className="mt-5 grid gap-4" onSubmit={resetPassword}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" required />
            <Button type="button" variant="secondary" onClick={requestResetOtp}>Send OTP</Button>
          </div>
          {devOtp ? <p className="rounded-md bg-secondary p-3 text-sm font-semibold text-primary">Development OTP: {devOtp}</p> : null}
          <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="6-digit OTP" inputMode="numeric" maxLength={6} required />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" type="password" minLength={8} required />
          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p> : null}
          {message ? <p className="rounded-md bg-secondary p-3 text-sm font-semibold text-primary">{message}</p> : null}
          <Button type="submit">Reset password</Button>
        </form>
      </Card>
    </main>
  );
}

// Placeholder verification center for future multi-step agent onboarding.
function VerificationPage() {
  return (
    <main className="page-shell py-10">
      <SectionTitle icon={<ShieldCheck />} eyebrow="Verification" title="Agent verification center" />
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {["Identity document", "Office or landlord proof", "Bank profile"].map((item, index) => (
          <Card key={item} className="p-5">
            <span className="grid size-12 place-items-center rounded-md bg-secondary text-primary">{index + 1}</span>
            <h2 className="mt-5 text-xl font-black">{item}</h2>
            <p className="mt-2 text-muted-foreground">Upload, validate, and submit for admin approval.</p>
          </Card>
        ))}
      </div>
    </main>
  );
}

// Favorites currently reuses the first few lodges until saved favorites are persisted.
function FavoritesPage({ lodges }: { lodges: Lodge[] }) {
  return (
    <main className="page-shell py-10">
      <SectionTitle icon={<Heart />} eyebrow="Favorites" title="Saved lodges" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{lodges.slice(0, 3).map((lodge) => <LodgeCard key={lodge.id} lodge={lodge} />)}</div>
    </main>
  );
}

// Legal/policy pages are content-driven to avoid separate components for each policy.
function PolicyPage({ type }: { type: "privacy" | "terms" | "refund" | "abuse" }) {
  const content = {
    privacy: {
      title: "Privacy policy",
      body: [
        "Zik Lodge collects account, contact, verification, lodge, chat, report, and transaction information needed to run the marketplace safely.",
        "Student private details are visible only to that student and authorized admins. Agents see only the contact details students choose to share through lodge contact and messaging flows.",
        "Uploaded identity documents are restricted to verification review and must be stored in secure cloud storage with access controls in production."
      ]
    },
    terms: {
      title: "Terms of use",
      body: [
        "Students must use accurate contact details and report suspicious listings responsibly.",
        "Agents must upload only real lodges they are authorized to market, keep availability current, and accept admin verification before posting.",
        "Admins may restrict, suspend, reject, or ban accounts connected to fake listings, fraud, abuse, or policy violations."
      ]
    },
    refund: {
      title: "Refund policy",
      body: [
        "Agent verification payments are reviewed by the Zik Lodge admin team before privileges are finalized.",
        "When a student marks a lodge and the agent confirms the successful deal, the transaction is recorded for admin review.",
        "Disputed payments can be reviewed from the admin dashboard using transaction, report, chat, and audit records."
      ]
    },
    abuse: {
      title: "Report-abuse policy",
      body: [
        "Students can report fake lodges, misleading prices, unsafe agents, duplicate listings, or harassment.",
        "Reports are delivered to the admin dashboard notification room for review.",
        "Confirmed abuse may lead to listing removal, account restriction, verification rejection, or a permanent ban."
      ]
    }
  }[type];

  return (
    <main className="page-shell py-10">
      <SectionTitle icon={<ShieldCheck />} eyebrow="Policy" title={content.title} />
      <Card className="mt-8 p-5">
        <div className="grid gap-4 text-muted-foreground">
          {content.body.map((item) => <p key={item}>{item}</p>)}
        </div>
      </Card>
    </main>
  );
}

// Static company/product context page.
function AboutPage() {
  return (
    <main className="page-shell py-16">
      <SectionTitle icon={<Building2 />} eyebrow="About" title="A scalable lodge marketplace for Nigerian universities" />
      <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
        Zik Lodge starts with UNIZIK and is structured for expansion across Nigeria. Listings are tied to universities, agents pass verification, reports flow to admin moderation, and successful student deals are recorded.
      </p>
    </main>
  );
}

// Contact form opens the user's email client with a prefilled support message.
function ContactPage() {
  const [contact, setContact] = useState({ name: "", email: "", topic: "Student support", message: "" });
  const [sent, setSent] = useState("");

  function updateContact(field: keyof typeof contact, value: string) {
    setContact((current) => ({ ...current, [field]: value }));
  }

  function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent(`Zik Lodge ${contact.topic} message from ${contact.name}`);
    const body = encodeURIComponent(
      `Name: ${contact.name}\nEmail: ${contact.email}\nTopic: ${contact.topic}\n\nMessage:\n${contact.message}`
    );
    window.location.href = `mailto:supporttearmziklodge@gmail.com?subject=${subject}&body=${body}`;
    setSent(`Thanks ${contact.name}. Your message is ready to send to supporttearmziklodge@gmail.com.`);
    setContact({ name: "", email: "", topic: "Student support", message: "" });
  }

  return (
    <main className="page-shell grid gap-8 py-16 lg:grid-cols-2">
      <section>
        <SectionTitle icon={<Phone />} eyebrow="Contact" title="Reach the Zik Lodge team" />
        <p className="mt-6 text-lg text-muted-foreground">For student support, agent onboarding, listing disputes, and university expansion partnerships.</p>
      </section>
      <Card as="form" className="grid gap-4 p-5" onSubmit={handleContactSubmit}>
        <Input value={contact.name} onChange={(event) => updateContact("name", event.target.value)} placeholder="Name" required />
        <Input value={contact.email} onChange={(event) => updateContact("email", event.target.value)} placeholder="Email" type="email" required />
        <Select value={contact.topic} onChange={(event) => updateContact("topic", event.target.value)}>
          <option>Student support</option>
          <option>Agent onboarding</option>
          <option>Listing dispute</option>
          <option>University partnership</option>
        </Select>
        <textarea
          className="min-h-32 rounded-md border border-input bg-background p-3 outline-none focus:ring-2 focus:ring-ring"
          value={contact.message}
          onChange={(event) => updateContact("message", event.target.value)}
          placeholder="Message"
          minLength={10}
          required
        />
        {sent ? <p className="rounded-md bg-secondary p-3 text-sm font-semibold text-primary">{sent}</p> : null}
        <Button type="submit">Send message</Button>
      </Card>
    </main>
  );
}

// Small dashboard helpers keep cards, tables, metrics, and headings consistent.
function Stats({ stats }: { stats: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([label, value]) => (
        <Card key={label} className="p-5">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </Card>
      ))}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {headers.map((header) => <th key={header} className="py-3 pr-3 font-bold">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")} className="border-b border-border/70">
              {row.map((cell) => <td key={cell.toString()} className="py-3 pr-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <p className="text-lg font-black">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionTitle({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <div>
      <Badge className="gap-2 bg-secondary text-primary">{icon}{eyebrow}</Badge>
      <h2 className="mt-4 max-w-3xl text-3xl font-black md:text-5xl">{title}</h2>
    </div>
  );
}

// Site footer with navigation, trust links, support contact, and Casara branding.
function Footer() {
  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="page-shell grid gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" className="flex items-center gap-2 font-black text-foreground">
            <span className="grid size-11 place-items-center rounded-md border border-border bg-white p-1 shadow-sm">
              <img className="h-full w-full object-contain" src="/unizikpic.png" alt="UNIZIK logo" />
            </span>
            Zik Lodge
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">A verified student lodge marketplace for UNIZIK students, trusted agents, landlords, and subletters.</p>
          <p className="mt-4 text-sm font-semibold text-primary">UNIZIK today, Nigerian universities tomorrow.</p>
        </div>
        <div>
          <h3 className="font-black">Marketplace</h3>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link to="/lodges">Browse lodges</Link>
            <Link to="/favorites">Favorites</Link>
            <Link to="/contact">Contact team</Link>
            <Link to="/report-abuse-policy">Report abuse</Link>
          </div>
        </div>
        <div>
          <h3 className="font-black">Dashboards</h3>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link to="/student">Student dashboard</Link>
            <Link to="/agent">Agent dashboard</Link>
            <Link to="/admin">Admin dashboard</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
        <div>
          <h3 className="font-black">Trust and support</h3>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck size={16} /> Agent verification</span>
            <span className="flex items-center gap-2"><Flag size={16} /> Fake lodge reporting</span>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/refund-commission-policy">Refund policy</Link>
            <a className="flex items-center gap-2" href="mailto:supporttearmziklodge@gmail.com"><Mail size={16} /> supporttearmziklodge@gmail.com</a>
          </div>
        </div>
      </div>
      <div className="page-shell mt-8 border-t border-border pt-5 text-sm text-muted-foreground">
        <p>© 2026 Casara. Zik Lodge is built for safer student accommodation around Nnamdi Azikiwe University.</p>
      </div>
    </footer>
  );
}

export default App;
