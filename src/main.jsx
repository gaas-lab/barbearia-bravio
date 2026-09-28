import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Ban, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, DollarSign, Droplets, House, ImagePlus, LayoutDashboard, Lightbulb, LockKeyhole, LogOut, Menu, Moon, MoreHorizontal, Package, Pencil, Plus, Scissors, Search, Settings2, ShieldCheck, Sun, Store, UserRound, Users, Wallet, Wifi, X, XCircle, Trash2, Repeat2 } from 'lucide-react';
import './styles.css';
import { cloudEnabled, supabase, getManagerShop, getBarberAccount, getBarberWorkspace, fetchBlockRequests, saveManagerWorkspace, saveCloudBarberAccount, submitCloudBlockRequest, reviewCloudBlockRequest, watchBlockRequests } from './lib/barbershopCloud.js';

const STORAGE = 'barber-studio-v1';
const CLEAN_START_VERSION = 'bravio-clean-start-v2';
const AUTH_STORAGE = 'bravio-master-auth-v1';
const PROFILE_STORAGE = 'bravio-master-profile-v1';
const SESSION_STORAGE = 'bravio-master-session-v1';
const PALETTE = ['#bd8058', '#547c67', '#8b72b5', '#d06d63', '#c5a344', '#54859a'];
const WEEKDAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const DEFAULT_HOURS = WEEKDAYS.map((_, day) => ({ day, isOpen: true, open: '08:00', close: '20:00' }));
const initial = {
  barbers: [],
  services: [],
  appointments: [], withdrawals: [], expenses: [], businessHours: DEFAULT_HOURS, businessBlocks: [], blockRequests: [], shopName: 'Bravio Studio', shopLogo: '', open: true, accent: '#bd8058', dark: false,
};
const money = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const currentMonthKey = () => todayKey().slice(0, 7);
const monthLabel = (key) => { const [year, month] = key.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)); };
const shiftMonth = (key, amount) => { const [year, month] = key.split('-').map(Number); const d = new Date(year, month - 1 + amount, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const shortDate = (iso) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${iso}T12:00:00`));
const prettyToday = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const initials = (name='') => name.split(' ').slice(0,2).map((n) => n[0]).join('').toUpperCase();
const phoneMask = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!number) return `(${ddd})`;
  return `(${ddd}) ${number.slice(0, 1)}${number.length > 1 ? ` ${number.slice(1, 5)}` : ''}${number.length > 5 ? `-${number.slice(5)}` : ''}`;
};
const timeSlots = Array.from({ length: 25 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
const timeMinutes = (time) => { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; };
const addTime = (time, amount) => { const value=timeMinutes(time)+amount;return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`; };
const dateLabel = (iso) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
const shiftDate = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

function readStore() {
  try {
    prepareCleanStart();
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    const categoryAliases = { Luz: 'Energia elétrica', Internet: 'Internet e telefonia', Materiais: 'Produtos e materiais' };
    return { ...initial, ...saved, blockRequests: saved.blockRequests || [], expenses: (saved.expenses || []).map(expense => ({ ...expense, category: categoryAliases[expense.category] || expense.category })) };
  }
  catch { return initial; }
}
function prepareCleanStart() {
  if (localStorage.getItem(CLEAN_START_VERSION) === 'done') return;
  [STORAGE, AUTH_STORAGE, PROFILE_STORAGE].forEach(key => localStorage.removeItem(key));
  sessionStorage.removeItem(SESSION_STORAGE);
  localStorage.setItem(CLEAN_START_VERSION, 'done');
}
function readAuth() { try { prepareCleanStart(); return JSON.parse(localStorage.getItem(AUTH_STORAGE) || 'null'); } catch { return null; } }
function readProfile() { try { return { name: 'Gabriel Costa', email: '', photo: '', ...JSON.parse(localStorage.getItem(PROFILE_STORAGE) || '{}') }; } catch { return { name: 'Gabriel Costa', email: '', photo: '' }; } }
function readSession() { const value=sessionStorage.getItem(SESSION_STORAGE); if(value==='active')return {role:'master'};try{return value?JSON.parse(value):null;}catch{return null;} }
async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g) || [], part => parseInt(part, 16));
  const digest = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function newSalt() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''); }

function App() {
  const [auth, setAuth] = useState(readAuth);
  const [session, setSession] = useState(() => cloudEnabled ? null : readSession());
  const [cloudReady,setCloudReady]=useState(!cloudEnabled);
  const [needsPasswordSetup,setNeedsPasswordSetup]=useState(false);
  const [profile, setProfile] = useState(readProfile);
  const [data, setData] = useState(readStore);
  const [view, setView] = useState('Visão geral');
  const [modal, setModal] = useState('');
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [agendaDate, setAgendaDate] = useState(todayKey());
  const [appointmentDefaults, setAppointmentDefaults] = useState({ date: todayKey(), time: '09:00', barberId: '' });
  const [reportMonth, setReportMonth] = useState(currentMonthKey());
  const [editingBarber, setEditingBarber] = useState(null);
  const [calendarActionTab, setCalendarActionTab] = useState('appointment');
  useEffect(() => {
    if(!cloudEnabled)localStorage.setItem(STORAGE, JSON.stringify(data));
    localStorage.setItem(PROFILE_STORAGE, JSON.stringify(profile));
    document.documentElement.dataset.theme = data.dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--accent', data.accent);
    document.documentElement.style.setProperty('--accent-soft', `${data.accent}18`);
    if(cloudEnabled&&session?.role==='master'&&session.shopId){
      const timer=window.setTimeout(()=>saveManagerWorkspace(session.shopId,data).catch(error=>notify('Não foi possível sincronizar os dados com o Supabase: '+error.message)),500);
      return()=>window.clearTimeout(timer);
    }
  }, [data, profile, session]);
  async function restoreCloudSession(user) {
    const account=await getBarberAccount(user.id);
    if(account?.active){
      const workspace=await getBarberWorkspace();
      setData({...initial,...workspace});
      setProfile(p=>({...p,name:workspace.barbers?.[0]?.name||user.email,email:user.email||''}));
      setNeedsPasswordSetup(Boolean(user.user_metadata?.invite_pending));
      setSession({role:'barber',barberId:account.barber_id,shopId:account.shop_id,userId:user.id});
      return true;
    }
    const shop=await getManagerShop(user.id);
    if(!shop){await supabase.auth.signOut();setSession(null);return false;}
    const workspace=shop.data?.barbers?shop.data:readStore();
    const requests=await fetchBlockRequests(shop.id);
    setData({...initial,...workspace,blockRequests:requests});
    setProfile(p=>({...p,name:user.user_metadata?.name||p.name,email:user.email||''}));
    setNeedsPasswordSetup(false);
    setSession({role:'master',shopId:shop.id,userId:user.id});
    return true;
  }
  useEffect(()=>{
    if(!cloudEnabled)return;
    let active=true;
    supabase.auth.getSession().then(async({data:result,error})=>{
      if(!active)return;
      if(error)throw error;
      if(result.session)await restoreCloudSession(result.session.user);
      else setSession(null);
    }).catch(error=>{if(active){console.error('Supabase session restore failed:',error);setSession(null);}})
      .finally(()=>{if(active)setCloudReady(true);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!cloudEnabled||session?.role!=='master'||!session.shopId)return;
    const channel=watchBlockRequests(session.shopId,async payload=>{
      const requests=await fetchBlockRequests(session.shopId);
      setData(current=>{
        const previous=new Set((current.blockRequests||[]).map(item=>item.id));
        const fresh=requests.find(item=>item.status==='Pendente'&&!previous.has(item.id));
        if(fresh)notify('Novo pedido de bloqueio de '+fresh.barberName);
        return {...current,blockRequests:requests};
      });
    });
    return()=>{supabase.removeChannel(channel);};
  },[session?.role,session?.shopId]);
  useEffect(() => {
    function syncTab(event) {
      if (event.key !== STORAGE || !event.newValue) return;
      try {
        const incoming=JSON.parse(event.newValue);
        const previous=new Set((data.blockRequests||[]).map(item=>item.id));
        const fresh=(incoming.blockRequests||[]).find(item=>item.status==='Pendente'&&!previous.has(item.id));
        setData({...initial,...incoming});
        if(fresh && session?.role==='master') notify(`Novo pedido de bloqueio de ${fresh.barberName}`);
      } catch { /* ignore incomplete browser storage updates */ }
    }
    window.addEventListener('storage',syncTab);
    return()=>window.removeEventListener('storage',syncTab);
  },[data.blockRequests,session?.role]);
  useEffect(()=>{
    if(session?.role==='barber'&&!data.barbers.some(item=>item.id===session.barberId)){
      sessionStorage.removeItem(SESSION_STORAGE);
      setSession(null);
    }
  },[session,data.barbers]);
  const update = (key, value) => setData((d) => ({ ...d, [key]: typeof value === 'function' ? value(d[key]) : value }));
  const todayAppointments = useMemo(() => data.appointments.filter((a) => a.date === todayKey()).sort((a,b) => a.time.localeCompare(b.time)), [data.appointments]);
  const todayRevenue = todayAppointments.reduce((sum, a) => sum + a.total, 0);
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const navItems = [{ name: 'Visão geral', icon: LayoutDashboard }, { name: 'Agenda', icon: CalendarDays }, { name: 'Desempenho', icon: BarChart3 }, { name: 'Financeiro', icon: Wallet }, { name: 'Barbeiros', icon: Users }, { name: 'Serviços', icon: Scissors }, { name: 'Minha barbearia', icon: Store }];

  function saveAppointment(appt) {
    update('appointments', (list) => [...list, { ...appt, id: crypto.randomUUID() }]);
    setModal(''); notify('Atendimento adicionado à agenda');
  }
  async function saveBarber(barber) {
    const { password, ...details } = barber;
    const existing=data.barbers.find(item=>item.id===barber.id);
    const barberId=barber.id||crypto.randomUUID();
    if(cloudEnabled){
      const savedBarber={id:barberId,name:details.name,role:details.role,color:details.color,photo:details.photo,commission:details.commission,accessEmail:details.accessEmail.trim().toLowerCase()};
      const nextWorkspace={...data,barbers:barber.id?data.barbers.map(item=>item.id===barberId?savedBarber:item):[...data.barbers,savedBarber]};
      await saveManagerWorkspace(session.shopId,nextWorkspace);
      await saveCloudBarberAccount({shopId:session.shopId,barberId,email:savedBarber.accessEmail,password,invite:!barber.id||!existing?.accessEmail});
      setData(nextWorkspace);
      notify(barber.id?'Dados do barbeiro atualizados':'Barbeiro cadastrado e convite enviado por e-mail');
      setEditingBarber(null);setModal('');return;
    }
    let safeAccess=existing?.access;
    if(password){const salt=newSalt();safeAccess={email:details.accessEmail.trim().toLowerCase(),salt,hash:await passwordDigest(password,salt)};}
    else if(safeAccess&&details.accessEmail)safeAccess={...safeAccess,email:details.accessEmail.trim().toLowerCase()};
    const savedBarber={...details,access:safeAccess};
    delete savedBarber.accessEmail;
    if (barber.id) {
      update('barbers', (list) => list.map(item => item.id === barber.id ? savedBarber : item));
      notify('Dados do barbeiro atualizados');
    } else {
      update('barbers', (list) => [...list, { ...savedBarber, id: crypto.randomUUID() }]);
      notify('Barbeiro cadastrado');
    }
    setEditingBarber(null); setModal('');
  }
  function saveService(service) {
    update('services', (list) => [...list, { ...service, id: crypto.randomUUID() }]);
    setModal(''); notify('Serviço adicionado ao cardápio');
  }
  function saveWithdrawal(withdrawal) {
    update('withdrawals', (list) => [...(list || []), { ...withdrawal, id: crypto.randomUUID() }]);
    setModal(''); notify('Retirada registrada');
  }
  function saveExpense(expense) {
    update('expenses', (list) => [...(list || []), { ...expense, id: crypto.randomUUID() }]);
    setModal(''); notify('Despesa registrada');
  }
  function removeExpense(id) {
    update('expenses', (list) => (list || []).filter(item => item.id !== id)); notify('Despesa removida');
  }
  function removeWithdrawal(id) {
    update('withdrawals', (list) => (list || []).filter(item => item.id !== id)); notify('Retirada removida');
  }
  function saveBusinessSettings({ shopName, businessHours }) {
    update('shopName', shopName.trim() || 'Minha barbearia'); update('businessHours', businessHours); notify('Dados da barbearia atualizados');
  }
  function saveBusinessBlock(block) {
    update('businessBlocks', list => [...(list || []), { ...block, id: crypto.randomUUID() }]); setModal(''); notify('Bloqueio adicionado à agenda');
  }
  function submitBlockRequest(request) {
    if(cloudEnabled){
      return submitCloudBlockRequest(request).then(saved=>{update('blockRequests',list=>[...(list||[]),saved]);});
    }
    update('blockRequests', list => [...(list||[]), {...request,id:crypto.randomUUID(),status:'Pendente',createdAt:new Date().toISOString()}]);
  }
  async function reviewBlockRequest(id,status) {
    const request=(data.blockRequests||[]).find(item=>item.id===id);
    if(status==='Aprovado'&&request){
      const start=timeMinutes(request.start),end=timeMinutes(request.end);
      const conflict=data.appointments.find(item=>item.barberId===request.barberId&&item.date===request.date&&start<timeMinutes(item.time)+item.duration&&timeMinutes(item.time)<end);
      const occupied=(data.businessBlocks||[]).find(item=>item.date===request.date&&(!item.barberId||item.barberId===request.barberId)&&start<timeMinutes(item.end)&&timeMinutes(item.start)<end);
      if(conflict||occupied){notify(`Não foi possível aprovar: o período conflita com ${conflict?`um atendimento às ${conflict.time}`:'outro bloqueio'}.`);return;}
    }
    if(cloudEnabled){
      try{await reviewCloudBlockRequest(id,status);}catch(error){notify('Não foi possível analisar o pedido: '+error.message);return;}
    }
    setData(current=>{
      const request=(current.blockRequests||[]).find(item=>item.id===id);
      if(!request||request.status!=='Pendente')return current;
      return {...current,blockRequests:current.blockRequests.map(item=>item.id===id?{...item,status,reviewedAt:new Date().toISOString()}:item),businessBlocks:status==='Aprovado'?[...(current.businessBlocks||[]),{...request,id:crypto.randomUUID()}]:current.businessBlocks};
    });
    notify(status==='Aprovado'?'Bloqueio aprovado e adicionado à agenda':'Pedido de bloqueio recusado');
  }
  function removeBusinessBlock(id) {
    update('businessBlocks', list => (list || []).filter(block => block.id !== id)); notify('Bloqueio removido');
  }
  function openBlockModal(date=todayKey(), time='12:00', barberId='') {
    setAppointmentDefaults({ date, time, barberId }); setModal('block');
  }
  function openCalendarAction(tab, date, time, barberId) {
    setAppointmentDefaults({ date, time, barberId }); setCalendarActionTab(tab); setModal('calendar-action');
  }
  async function createMaster({ name, email, password }) {
    if(cloudEnabled){
      const {data:result,error}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{role:'manager',name:name.trim(),shop_name:'Bravio Studio'}}});
      if(error)throw error;
      if(!result.session)return false;
      await restoreCloudSession(result.user);
      setProfile(p=>({...p,name:name.trim(),email:result.user.email||email}));
      return true;
    }
    const salt = newSalt();
    const nextAuth = { email: email.trim().toLowerCase(), salt, hash: await passwordDigest(password, salt) };
    localStorage.setItem(AUTH_STORAGE, JSON.stringify(nextAuth));
    setAuth(nextAuth); setProfile(p => ({ ...p, name: name.trim(), email: nextAuth.email }));
    sessionStorage.setItem(SESSION_STORAGE, 'active'); setSession({role:'master'});
  }
  async function signIn(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    if(cloudEnabled){
      const {data:result,error}=await supabase.auth.signInWithPassword({email:normalizedEmail,password});
      if(error||!result.user)return false;
      const account=await getBarberAccount(result.user.id);
      if(!account?.active){await supabase.auth.signOut();return false;}
      const workspace=await getBarberWorkspace();
      setData({...initial,...workspace});
      setProfile(p=>({...p,name:workspace.barbers?.[0]?.name||normalized,email:normalized}));
      setNeedsPasswordSetup(Boolean(result.user.user_metadata?.invite_pending));
      setSession({role:'barber',barberId:account.barber_id,shopId:account.shop_id,userId:result.user.id});
      return true;
    }
    if (!auth || normalizedEmail !== auth.email || await passwordDigest(password, auth.salt) !== auth.hash) return false;
    sessionStorage.setItem(SESSION_STORAGE, 'active'); setSession({role:'master'}); return true;
  }
  async function signInBarber(email,password) {
    const normalized=email.trim().toLowerCase();
    if(cloudEnabled){
      const {data:result,error}=await supabase.auth.signInWithPassword({email:normalized,password});
      if(error||!result.user)return false;
      return restoreCloudSession(result.user);
    }
    const barber=data.barbers.find(item=>item.access?.email===normalized);
    if(!barber||await passwordDigest(password,barber.access.salt)!==barber.access.hash)return false;
    const next={role:'barber',barberId:barber.id};sessionStorage.setItem(SESSION_STORAGE,JSON.stringify(next));setSession(next);return true;
  }
  async function changeMasterPassword(currentPassword, newPassword) {
    if(cloudEnabled){
      const {error:verifyError}=await supabase.auth.signInWithPassword({email:auth?.email||profile.email,password:currentPassword});
      if(verifyError)return false;
      const {error}=await supabase.auth.updateUser({password:newPassword});
      return !error;
    }
    if (!auth || await passwordDigest(currentPassword, auth.salt) !== auth.hash) return false;
    const salt = newSalt(); const nextAuth = { ...auth, salt, hash: await passwordDigest(newPassword, salt) };
    localStorage.setItem(AUTH_STORAGE, JSON.stringify(nextAuth)); setAuth(nextAuth); return true;
  }
  function signOut() { sessionStorage.removeItem(SESSION_STORAGE); if(cloudEnabled)supabase.auth.signOut(); setSession(null); setNeedsPasswordSetup(false); setModal(''); }
  function toggleStatus(id) {
    update('appointments', (list) => list.map((a) => a.id === id ? { ...a, status: a.status === 'Concluído' ? 'Agendado' : 'Concluído' } : a));
  }
  const filteredAppointments = todayAppointments.filter((a) => `${a.client} ${a.barberName}`.toLowerCase().includes(search.toLowerCase()));
  const pendingBlockRequests=(data.blockRequests||[]).filter(item=>item.status==='Pendente');

  if(cloudEnabled&&!cloudReady)return <main className="login-screen"><section className="login-side"><div className="login-card"><span className="login-icon"><Wifi size={19}/></span><h2>Conectando sua barbearia</h2><p className="login-subtitle">Verificando seu acesso com segurança.</p></div></section></main>;
  if (!session) return <LoginScreen hasAccount={cloudEnabled||Boolean(auth)} onCreate={createMaster} onLogin={signIn} onLoginBarber={signInBarber} cloudEnabled={cloudEnabled} />;
  if(session.role==='barber') {
    if(needsPasswordSetup)return <BarberInviteAcceptance barberName={profile.name} onSave={async password=>{const {error}=await supabase.auth.updateUser({password,data:{invite_pending:false}});if(error)throw error;setNeedsPasswordSetup(false);}}/>;
    const barber=data.barbers.find(item=>item.id===session.barberId);
    if(!barber)return <div className="login-screen"><p className="login-subtitle">Encerrando acesso inválido…</p></div>;
    return <BarberPortal barber={barber} data={data} onRequestBlock={submitBlockRequest} onSignOut={signOut}/>;
  }

  return <div className="app-layout">
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <a className="brand" href="#inicio" onClick={() => setView('Visão geral')}><span className="brand-symbol"><Scissors size={19} /></span><span>bravio<small>BARBERSHOP</small></span></a>
      <button className="shop-switch" onClick={() => { setView('Minha barbearia'); setMobileNav(false); }}><ShopLogo data={data}/><span><b>{data.shopName || 'Bravio Studio'}</b><small>Unidade principal</small></span><ChevronDown size={15} /></button>
      <p className="nav-label">MENU PRINCIPAL</p>
      <nav>{navItems.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${view === name ? 'active' : ''}`} onClick={() => { setView(name); setMobileNav(false); }}><Icon size={18} /><span>{name}</span>{name === 'Agenda' && <span className="nav-count">{todayAppointments.length}</span>}{name==='Visão geral'&&pendingBlockRequests.length>0&&<span className="nav-count request-count">{pendingBlockRequests.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="plan-card"><span className="plan-icon"><ShieldCheck size={17} /></span><b>Seu espaço, seu ritmo</b><p>Gestão simples para uma barbearia cheia de estilo.</p></div><button className="nav-item" onClick={() => setModal('settings')}><Settings2 size={18} /><span>Personalizar visual</span></button><button className="master-profile" onClick={() => setModal('profile')}><ProfileAvatar profile={profile}/><span><b>{profile.name}</b><small>Administrador master</small></span><MoreHorizontal size={18} /></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button><div className="breadcrumb">{data.shopName || 'Bravio Studio'} <ChevronRight size={14} /> <b>{view}</b></div><div className="topbar-actions"><span className="today-chip"><CalendarDays size={15} />{prettyToday()}</span><button className="theme-toggle" onClick={() => update('dark', !data.dark)} title={data.dark ? 'Usar tema claro' : 'Usar tema escuro'}>{data.dark ? <Sun size={17} /> : <Moon size={17} />}<span>{data.dark ? 'Modo claro' : 'Modo escuro'}</span></button><button className="top-avatar top-avatar-button" onClick={() => setModal('profile')} title="Abrir perfil do administrador"><ProfileAvatar profile={profile}/></button></div></header>
      <div className="page-content">
        {(view === 'Visão geral' || view === 'Agenda') && <>
          <section className="page-heading"><div><p className="eyebrow">{view === 'Agenda' ? 'ORGANIZAÇÃO DO DIA' : 'QUARTA-FEIRA · SEU RESUMO'}</p><h1>{view === 'Agenda' ? 'Agenda da barbearia' : 'Bom dia, Gabriel'}<span className="heading-dot">.</span></h1><p className="muted">{view === 'Agenda' ? 'Acompanhe os horários e os atendimentos da equipe.' : 'Tudo certo por aqui. Veja como está o movimento hoje.'}</p></div><div className="heading-actions"><button className="button button-soft" onClick={() => update('open', !data.open)}><span className={`status-dot ${data.open ? 'is-open' : ''}`} />Agenda {data.open ? 'aberta' : 'fechada'} <ChevronDown size={15} /></button><button className="button button-primary" onClick={() => { if(view==='Agenda')openCalendarAction('appointment',agendaDate,'09:00','');else setModal('appointment'); }}><Plus size={17} /> Novo atendimento</button></div></section>
          {view==='Visão geral'&&pendingBlockRequests.length>0&&<BlockRequestsPanel requests={pendingBlockRequests} onReview={reviewBlockRequest}/>}
          {view === 'Visão geral' && <section className="stats-grid">
            <Stat icon={CalendarDays} label="Agendamentos hoje" value={String(todayAppointments.length).padStart(2,'0')} change="na agenda de hoje" tone="blue" />
            <Stat icon={DollarSign} label="Faturamento previsto" value={money(todayRevenue)} change="valor após descontos" tone="green" />
            <Stat icon={Users} label="Barbeiros ativos" value={String(data.barbers.length).padStart(2,'0')} change="prontos para atender" tone="purple" />
            <Stat icon={Activity} label="Ocupação da agenda" value={todayAppointments.length ? `${Math.min(todayAppointments.length * 18,100)}%` : '0%'} change="ao longo do dia" tone="orange" />
          </section>}
          {view === 'Agenda' ? <AgendaCalendar date={agendaDate} setDate={setAgendaDate} barbers={data.barbers} appointments={data.appointments} blocks={data.businessBlocks || []} businessHours={data.businessHours || DEFAULT_HOURS} isOpen={data.open} search={search} setSearch={setSearch} onSelectSlot={(barber, time) => openCalendarAction('appointment',agendaDate,time,barber.id)} onToggleStatus={toggleStatus} onBlock={(time='12:00',barberId='')=>openCalendarAction('block',agendaDate,time,barberId)} /> : <section className="content-grid">
            <article className="panel agenda-panel"><div className="panel-heading"><div><p className="eyebrow">{view === 'Agenda' ? 'TODOS OS HORÁRIOS' : 'ACOMPANHAMENTO EM TEMPO REAL'}</p><h2>Agenda de hoje <span className="sub-count">{todayAppointments.length} atendimentos</span></h2></div><div className="panel-tools"><label className="search-box"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" /></label><button className="icon-btn" aria-label="Mais opções"><MoreHorizontal size={18} /></button></div></div>
              {filteredAppointments.length ? <div className="appointment-list">{filteredAppointments.map((appt) => <AppointmentRow key={appt.id} appt={appt} onToggle={() => toggleStatus(appt.id)} />)}</div> : <div className="empty-state"><span><CalendarDays size={21} /></span><b>{search ? 'Nenhum resultado' : 'Sua agenda está livre por enquanto'}</b><p>{search ? 'Tente buscar por outro nome.' : 'Adicione um atendimento para começar a organizar o dia.'}</p>{!search && <button className="button button-primary button-small" onClick={() => setModal('appointment')}><Plus size={15} /> Adicionar horário</button>}</div>}
              <button className="panel-link" onClick={() => setView('Agenda')}>Ver agenda completa <ArrowRight size={15} /></button>
            </article>
            <article className="panel team-panel"><div className="panel-heading"><div><p className="eyebrow">TIME BRAVIO</p><h2>Seus barbeiros</h2></div><button className="icon-btn" aria-label="Adicionar barbeiro" onClick={() => setModal('barber')}><Plus size={18} /></button></div><div className="team-list">{data.barbers.slice(0,4).map((barber, i) => <div className="team-row" key={barber.id}><Avatar barber={barber} /><span className="team-copy"><b>{barber.name}</b><small>{barber.role}</small></span><span className="team-load"><i style={{ '--load': `${[70,45,82,55][i]}%` }} /><small>{todayAppointments.filter(a => a.barberId === barber.id).length} atend.</small></span></div>)}</div><button className="button button-outline full-button" onClick={() => setView('Barbeiros')}>Gerenciar barbeiros <ArrowRight size={15} /></button></article>
          </section>}
          {view === 'Visão geral' && <section className="lower-grid"><article className="panel insight-panel"><div className="insight-icon"><Activity size={18} /></div><div className="insight-copy"><p className="eyebrow">MOVIMENTO DE HOJE</p><h3>{todayAppointments.length ? 'Sua equipe está pronta para receber' : 'Um novo dia para fazer acontecer'}</h3><p>{todayAppointments.length ? `${todayAppointments.length} horários na agenda. O faturamento previsto é ${money(todayRevenue)}.` : 'Cadastre os horários e deixe tudo organizado para seus clientes.'}</p></div><div className="insight-decoration"><span /><span /><span /><span /><span /><span /><span /></div></article><article className="panel quick-panel"><div><p className="eyebrow">ACESSO RÁPIDO</p><h3>O que vamos fazer?</h3></div><div className="quick-actions"><button onClick={() => setModal('appointment')}><span><Plus size={16} /></span>Novo atendimento</button><button onClick={() => setModal('barber')}><span><UserRound size={16} /></span>Cadastrar barbeiro</button></div></article></section>}
        </>}
        {view === 'Barbeiros' && <section className="management-view"><div className="page-heading"><div><p className="eyebrow">EQUIPE BRAVIO</p><h1>Seus barbeiros<span className="heading-dot">.</span></h1><p className="muted">Gerencie a equipe e a porcentagem recebida por serviço.</p></div><button className="button button-primary" onClick={() => { setEditingBarber(null); setModal('barber'); }}><Plus size={17} /> Cadastrar barbeiro</button></div><div className="barber-grid">{data.barbers.map((b) => <article className="panel barber-card" key={b.id}><div className="barber-card-top"><Avatar barber={b} large /><button className="icon-btn" aria-label={`Editar ${b.name}`} onClick={() => { setEditingBarber(b); setModal('barber'); }}><Pencil size={15} /></button></div><h3>{b.name}</h3><p>{b.role}</p><div className={`barber-commission ${b.commission == null ? 'commission-pending' : ''}`}><span>Comissão por serviço</span><b>{b.commission == null ? 'Definir %' : `${b.commission}%`}</b></div><div className="barber-meta"><span><CalendarDays size={14} />{todayAppointments.filter(a => a.barberId === b.id).length} horários hoje</span><ArrowRight size={15} /></div></article>)}</div></section>}
        {view === 'Desempenho' && <BarberDashboard barbers={data.barbers} appointments={data.appointments} withdrawals={data.withdrawals || []} month={reportMonth} setMonth={setReportMonth} onAdd={() => setModal('withdrawal')} onRemove={removeWithdrawal} />}
        {view === 'Financeiro' && <FinanceDashboard appointments={data.appointments} expenses={data.expenses || []} month={reportMonth} setMonth={setReportMonth} onAdd={() => setModal('expense')} onRemove={removeExpense} />}
        {view === 'Minha barbearia' && <BusinessSettings data={data} update={update} onSave={saveBusinessSettings} onAddBlock={() => openBlockModal()} onRemoveBlock={removeBusinessBlock} />}
        {view === 'Serviços' && <section className="management-view"><div className="page-heading"><div><p className="eyebrow">CARDÁPIO DA CASA</p><h1>Serviços<span className="heading-dot">.</span></h1><p className="muted">Os serviços disponíveis para montar cada atendimento.</p></div><div className="heading-actions"><span className="button button-soft"><Scissors size={16} /> {data.services.length} serviços</span><button className="button button-primary" onClick={() => setModal('service')}><Plus size={17} /> Adicionar serviço</button></div></div><div className="panel services-panel"><div className="service-heading"><span>Serviço</span><span>Duração</span><span>Valor</span></div>{data.services.map(s => <div className="service-row" key={s.id}><span className="service-name"><i><Scissors size={15} /></i><b>{s.name}</b></span><span className="service-duration"><Clock3 size={14} />{s.duration} min</span><strong>{money(s.price)}</strong></div>)}</div></section>}
      </div>
      <footer className="app-footer"><span>BRAVIO STUDIO <i>•</i> GESTÃO DA BARBEARIA</span><span>Feito para cuidar de cada detalhe.</span></footer>
    </main>
    {modal === 'calendar-action' && <CalendarActionModal key={`${appointmentDefaults.date}-${appointmentDefaults.time}-${appointmentDefaults.barberId}`} data={data} defaults={appointmentDefaults} defaultTab={calendarActionTab} businessHours={data.businessHours||DEFAULT_HOURS} blocks={data.businessBlocks||[]} agendaOpen={data.open} barbers={data.barbers} onClose={()=>setModal('')} onSaveAppointment={saveAppointment} onSaveBlock={saveBusinessBlock} />}
    {modal === 'appointment' && <AppointmentModal key={`${appointmentDefaults.date}-${appointmentDefaults.time}-${appointmentDefaults.barberId}`} data={data} defaults={appointmentDefaults} businessHours={data.businessHours || DEFAULT_HOURS} blocks={data.businessBlocks || []} agendaOpen={data.open} onSwitchTab={() => setModal('block')} onClose={() => setModal('')} onSave={saveAppointment} />}
    {modal === 'barber' && <BarberModal barber={editingBarber} barbers={data.barbers} cloudEnabled={cloudEnabled} onClose={() => { setEditingBarber(null); setModal(''); }} onSave={saveBarber} />}
    {modal === 'service' && <ServiceModal onClose={() => setModal('')} onSave={saveService} />}
    {modal === 'withdrawal' && <WithdrawalModal barbers={data.barbers} onClose={() => setModal('')} onSave={saveWithdrawal} />}
    {modal === 'expense' && <ExpenseModal onClose={() => setModal('')} onSave={saveExpense} />}
    {modal === 'block' && <BlockModal key={`${appointmentDefaults.date}-${appointmentDefaults.time}-${appointmentDefaults.barberId}`} barbers={data.barbers} businessHours={data.businessHours || DEFAULT_HOURS} defaults={appointmentDefaults} onSwitchTab={() => setModal('appointment')} onClose={() => setModal('')} onSave={saveBusinessBlock} />}
    {modal === 'settings' && <SettingsModal data={data} update={update} onClose={() => setModal('')} />}
    {modal === 'profile' && <ProfileModal profile={profile} setProfile={setProfile} email={auth?.email || profile.email} onChangePassword={changeMasterPassword} onSignOut={signOut} onClose={() => setModal('')} />}
    {toast && <div className="toast"><Check size={15} />{toast}</div>}
  </div>;
}

function ProfileAvatar({ profile }) { return <span className="profile-avatar-image">{profile.photo ? <img src={profile.photo} alt=""/> : initials(profile.name)}</span>; }

function BarberInviteAcceptance({ barberName, onSave }) {
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  async function submit(event){event.preventDefault();setError('');if(password.length<8)return setError('A senha precisa ter pelo menos 8 caracteres.');if(password!==confirm)return setError('As senhas não coincidem.');setLoading(true);try{await onSave(password);}catch(reason){setError(reason?.message||'Não foi possível definir sua senha. Abra novamente o link do convite ou peça outro ao gerente.');}finally{setLoading(false);}}
  return <main className="login-screen"><section className="login-story"><a className="login-brand" href="#bravio"><span className="brand-symbol"><Scissors size={19}/></span><span>bravio<small>BARBERSHOP</small></span></a><div className="story-content"><span className="story-kicker"><i/> CONVITE DA EQUIPE</span><h1>Seu acesso.<br/>Sua agenda em <em>ordem.</em></h1><p>Crie uma senha para entrar no seu espaço individual da barbearia.</p></div><div className="login-story-foot"><span>ACESSO INDIVIDUAL</span><span>BRAVIO STUDIO</span></div></section><section className="login-side"><div className="login-card"><span className="login-icon"><LockKeyhole size={19}/></span><p className="eyebrow">CONVITE DO GERENTE</p><h2>Bem-vindo{barberName?`, ${barberName}`:''}</h2><p className="login-subtitle">Defina sua senha pessoal para aceitar o convite e acessar sua agenda.</p><form className="login-form" onSubmit={submit}><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" required/></label><label>Confirmar senha<input type="password" autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)} placeholder="Digite a senha novamente" required/></label>{error&&<p className="login-error">{error}</p>}<button className="login-submit" disabled={loading}>{loading?'Salvando…':'Criar senha e continuar'}<ArrowRight size={16}/></button></form><p className="local-auth-note">Depois, entre usando seu e-mail e a senha criada aqui.</p></div></section></main>;
}

function LoginScreen({ hasAccount, onCreate, onLogin, onLoginBarber, cloudEnabled=false }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [visible, setVisible] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [mode,setMode]=useState(()=>cloudEnabled?'create':hasAccount?'master':'create');
  async function submit(e) {
    e.preventDefault(); setError('');
    const creating=mode==='create'||!hasAccount;
    if (creating && password.length < 8) return setError('Crie uma senha com pelo menos 8 caracteres.');
    if (creating && password !== confirm) return setError('As senhas não coincidem.');
    setLoading(true);
    try {
      if (mode==='barber') { const ok=await onLoginBarber(email,password);if(!ok)setError('E-mail ou senha de barbeiro incorretos.'); }
      else if (creating) {const created=await onCreate({ name, email, password });if(created===false)setError(cloudEnabled?'A conta foi criada. Confirme o e-mail e depois entre como gerente.':'Não foi possível criar o acesso. Tente novamente.');}
      else { const ok = await onLogin(email, password); if (!ok) setError('E-mail ou senha incorretos.'); }
    } catch (reason) { setError(cloudEnabled?(reason?.message||'Falha ao conectar ao Supabase. Confira as configurações.'):'Não foi possível validar o acesso neste navegador. Tente novamente.'); }
    finally { setLoading(false); }
  }
  const creating=mode==='create'||!hasAccount;
  return <main className="login-screen"><section className="login-story"><a className="login-brand" href="#bravio"><span className="brand-symbol"><Scissors size={19}/></span><span>bravio<small>BARBERSHOP</small></span></a><div className="story-content"><span className="story-kicker"><i/> GESTÃO COM ESTILO</span><h1>Seu espaço.<br/>Seu jeito de <em>cuidar.</em></h1><p>Uma experiência feita para quem transforma um bom corte em um momento especial.</p><div className="story-card"><div className="story-card-top"><span className="story-card-mark"><Scissors size={14}/></span><span><b>BRAVIO STUDIO</b><small>PAINEL DA BARBEARIA</small></span><span className="story-live"><i/> SEU ESPAÇO</span></div><div className="story-card-bottom"><span><small>AGENDA</small><b>Seu dia, no ritmo certo</b></span><span className="story-mini-bars"><i/><i/><i/><i/><i/></span></div></div></div><div className="login-story-foot"><span>ESTILO EM CADA DETALHE</span><span>BRASÍLIA · DF</span></div></section><section className="login-side"><div className="login-mobile-brand"><a className="login-brand" href="#bravio"><span className="brand-symbol"><Scissors size={19}/></span><span>bravio<small>BARBERSHOP</small></span></a></div><div className="login-card"><span className="login-icon"><ShieldCheck size={19}/></span><p className="eyebrow">{creating?'SEU PRIMEIRO ACESSO':mode==='barber'?'ACESSO DO BARBEIRO':'ACESSO ADMINISTRATIVO'}</p><h2>{creating?'Vamos preparar seu espaço':mode==='barber'?'Acesse sua agenda':'Boas-vindas de volta'}</h2><p className="login-subtitle">{creating?'Crie o acesso do administrador master da barbearia.':mode==='barber'?'Use o e-mail do convite e a senha que você criou ao aceitá-lo.':'Entre com seu acesso master para continuar.'}</p>{(hasAccount||cloudEnabled)&&<div className="login-role-tabs"><button type="button" className={mode==='master'?'active':''} onClick={()=>{setMode('master');setError('');}}>Gerente</button><button type="button" className={mode==='barber'?'active':''} onClick={()=>{setMode('barber');setError('');}}>Barbeiro</button>{cloudEnabled&&<button type="button" className={mode==='create'?'active':''} onClick={()=>{setMode('create');setError('');}}>Criar gerente</button>}</div>}<form onSubmit={submit} className="login-form">{creating&&<label>Seu nome<input autoComplete="name" placeholder="Como podemos te chamar?" value={name} onChange={e=>setName(e.target.value)} required/></label>}<label>E-mail<input autoFocus type="email" autoComplete="username" placeholder="voce@barbearia.com" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<span className="password-input"><input type={visible?'text':'password'} autoComplete={creating?'new-password':'current-password'} placeholder={creating?'Mínimo de 8 caracteres':'Digite sua senha'} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" onClick={()=>setVisible(v=>!v)}>{visible?'Ocultar':'Mostrar'}</button></span></label>{creating&&<label>Confirmar senha<input type={visible?'text':'password'} autoComplete="new-password" placeholder="Digite a senha novamente" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>}{error&&<p className="login-error">{error}</p>}<button className="login-submit" disabled={loading}>{loading?'Aguarde…':creating?'Criar acesso master':mode==='barber'?'Entrar como barbeiro':'Entrar no painel'}<ArrowRight size={16}/></button></form><div className="login-security"><ShieldCheck size={15}/><span><b>{mode==='barber'?'Acesso individual':'Acesso master'}</b><small>{mode==='barber'?'A agenda e os valores do seu perfil.':'O perfil administrativo controla este espaço.'}</small></span></div><p className="local-auth-note">{cloudEnabled?'Acesso protegido pelo Supabase e sincronizado entre dispositivos.':'Acesso salvo apenas neste navegador. Configure Supabase para sincronizar.'}</p></div><div className="login-side-foot">© {new Date().getFullYear()} BRAVIO STUDIO <span>•</span> FEITO PARA CUIDAR DE CADA DETALHE</div></section></main>;
}

function ProfileModal({ profile, setProfile, email, onChangePassword, onSignOut, onClose }) {
  const [name, setName] = useState(profile.name); const [photo, setPhoto] = useState(profile.photo || ''); const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  function selectPhoto(e) { const file=e.target.files?.[0]; if(!file)return; if(file.size>2_000_000){setError('A foto precisa ter até 2 MB.');return;} const reader=new FileReader(); reader.onload=()=>{setPhoto(reader.result);setError('');}; reader.readAsDataURL(file); }
  function saveProfile(e) { e.preventDefault(); if(!name.trim()){setError('Informe seu nome.');return;} setProfile(p=>({...p,name:name.trim(),email,photo})); setMessage('Perfil atualizado.'); setError(''); }
  async function savePassword(e) { e.preventDefault(); setMessage('');setError(''); if(next.length<8)return setError('A nova senha precisa ter pelo menos 8 caracteres.');if(next!==confirm)return setError('A confirmação não corresponde à nova senha.');setLoading(true);try{const ok=await onChangePassword(current,next);if(!ok){setError('A senha atual está incorreta.');return;}setCurrent('');setNext('');setConfirm('');setMessage('Senha alterada com sucesso.');}catch{setError('Não foi possível atualizar a senha.');}finally{setLoading(false);} }
  return <ModalShell title="Perfil do administrador" subtitle="Atualize seus dados de acesso à Bravio Studio." onClose={onClose}><div className="profile-modal-content"><form className="modal-form profile-edit-form" onSubmit={saveProfile}><div className="profile-photo-row"><label className="profile-photo-picker"><ProfileAvatar profile={{...profile,name,photo}}/><input type="file" accept="image/*" onChange={selectPhoto}/><span>+</span></label><div><b>Foto do perfil</b><small>JPG ou PNG, até 2 MB</small><label className="upload-link">Alterar foto<input type="file" accept="image/*" onChange={selectPhoto}/></label></div></div><label>Nome<input value={name} onChange={e=>setName(e.target.value)} /></label><label>E-mail de acesso<input value={email} readOnly /></label>{message&&<p className="profile-success"><Check size={14}/>{message}</p>}{error&&<p className="form-error">{error}</p>}<button className="button button-primary profile-save" type="submit">Salvar perfil</button></form><form className="modal-form password-edit-form" onSubmit={savePassword}><div className="profile-section-heading"><b>Trocar senha</b><small>Escolha uma senha com pelo menos 8 caracteres.</small></div><label>Senha atual<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required /></label><label>Nova senha<input type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} required /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required /></label><button className="button button-soft profile-save" disabled={loading}>{loading?'Atualizando…':'Atualizar senha'}</button></form></div><div className="profile-modal-bottom"><span><ShieldCheck size={14}/>Administrador master</span><button onClick={onSignOut}><ArrowRight size={14}/>Sair da conta</button></div></ModalShell>;
}

function Stat({ icon: Icon, label, value, change, tone }) { return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><span className="stat-menu"><MoreHorizontal size={18} /></span><p>{label}</p><strong>{value}</strong><small><span className="stat-trend"><ArrowUpRight size={13} /></span>{change}</small></article>; }
function MonthPicker({ month, setMonth }) { return <div className="month-picker"><button className="icon-btn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mês anterior"><ChevronLeft size={16}/></button><span>{monthLabel(month)}</span><button className="icon-btn" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Próximo mês"><ChevronRight size={16}/></button></div>; }
function BarberDashboard({ barbers, appointments, withdrawals, month, setMonth, onAdd, onRemove }) {
  const monthAppointments = appointments.filter(a => a.date?.startsWith(month) && a.status === 'Concluído');
  const monthWithdrawals = withdrawals.filter(w => w.date?.startsWith(month));
  const serviceRevenue = monthAppointments.reduce((sum, a) => sum + Number(a.total || 0), 0);
  const withdrawn = monthWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const commissionTotal = barbers.reduce((sum, barber) => { if (barber.commission == null) return sum; const gross = monthAppointments.filter(a => a.barberId === barber.id).reduce((n,a) => n + Number(a.total || 0), 0); return sum + gross * Number(barber.commission) / 100; }, 0);
  const commissionPending = barbers.filter(barber => barber.commission == null).length;
  return <section className="management-view report-view"><div className="page-heading"><div><p className="eyebrow">EQUIPE · RESULTADOS</p><h1>Desempenho<span className="heading-dot">.</span></h1><p className="muted">Atendimentos concluídos e valores registrados para cada barbeiro.</p></div><div className="report-actions"><MonthPicker month={month} setMonth={setMonth}/><button className="button button-primary" onClick={onAdd}><Plus size={16}/> Registrar retirada</button></div></div><div className="stats-grid report-stats"><Stat icon={Check} label="Atendimentos concluídos" value={String(monthAppointments.length)} change={monthLabel(month)} tone="green"/><Stat icon={DollarSign} label="Comissões estimadas" value={money(commissionTotal)} change={commissionPending?`${commissionPending} barbeiro${commissionPending===1?'':'s'} sem percentual definido`:'percentual aplicado aos serviços'} tone="blue"/><Stat icon={ArrowDownRight} label="Adiantamentos e retiradas" value={money(withdrawn)} change={`${monthWithdrawals.length} registro${monthWithdrawals.length===1?'':'s'} no mês`} tone="orange"/></div><article className="panel report-panel"><div className="report-panel-heading"><div><p className="eyebrow">RESUMO POR BARBEIRO</p><h2>Produção da equipe</h2></div><span className="report-period">{monthLabel(month)}</span></div><div className="report-table-wrap"><table className="report-table"><thead><tr><th>BARBEIRO</th><th>ATENDIMENTOS</th><th>EM SERVIÇOS</th><th>COMISSÃO</th><th>RETIRADAS</th><th>SALDO A RECEBER</th></tr></thead><tbody>{barbers.map(barber=>{const work=monthAppointments.filter(a=>a.barberId===barber.id);const barberRevenue=work.reduce((sum,a)=>sum+Number(a.total||0),0);const takes=monthWithdrawals.filter(w=>w.barberId===barber.id);const taken=takes.reduce((sum,w)=>sum+Number(w.amount||0),0);const earned=barber.commission==null?null:barberRevenue*Number(barber.commission)/100;return <tr key={barber.id}><td><span className="report-person"><Avatar barber={barber}/><span><b>{barber.name}</b><small>{barber.role}</small></span></span></td><td><b>{work.length}</b></td><td><b>{money(barberRevenue)}</b></td><td><b className={earned==null?'commission-pending':''}>{earned==null?'Definir %':`${barber.commission}% · ${money(earned)}`}</b></td><td><b className="money-negative">{taken?`− ${money(taken)}`:money(0)}</b></td><td><b className="money-net">{earned==null?'—':money(earned-taken)}</b></td></tr>;})}{!barbers.length&&<tr><td colSpan="6" className="table-empty">Cadastre barbeiros para ver o desempenho.</td></tr>}</tbody></table></div><p className="report-note">A comissão é calculada sobre os atendimentos concluídos, já com descontos, usando a porcentagem cadastrada para cada barbeiro. O saldo subtrai as retiradas registradas.</p></article><article className="panel ledger-panel"><div className="report-panel-heading"><div><p className="eyebrow">CONTROLE DE VALORES</p><h2>Adiantamentos e retiradas</h2></div><button className="button button-soft button-small" onClick={onAdd}><Plus size={14}/> Novo registro</button></div>{monthWithdrawals.length?<div className="ledger-list">{[...monthWithdrawals].sort((a,b)=>b.date.localeCompare(a.date)).map(w=><div className="ledger-row" key={w.id}><span className="ledger-icon"><ArrowDownRight size={16}/></span><span className="ledger-copy"><b>{w.type} · {w.barberName}</b><small>{w.note||shortDate(w.date)}</small></span><span className="ledger-date">{shortDate(w.date)}</span><strong>{money(w.amount)}</strong><button className="row-delete" onClick={()=>onRemove(w.id)} aria-label="Remover retirada"><Trash2 size={14}/></button></div>)}</div>:<EmptyLedger icon={ArrowDownRight} title="Nenhuma retirada registrada neste mês" text="Registre vales e adiantamentos para acompanhar o saldo de cada barbeiro."/>}</article></section>;
}

const expenseCategoryGroups = [
  { label: 'Despesas fixas', items: ['Aluguel','Condomínio','Internet e telefonia','Folha de pagamento e encargos','Pró-labore','Contabilidade','Sistema de gestão','Seguro','Segurança e vigilância','Empréstimos e parcelas'] },
  { label: 'Contas de consumo', items: ['Água','Energia elétrica','Material de limpeza','Material de escritório'] },
  { label: 'Operacionais e variáveis', items: ['Produtos e materiais','Produtos para revenda','Manutenção de equipamentos','Comissões de barbeiros','Impostos e tributos','Taxas de cartão','Tarifas bancárias','Marketing e publicidade','Alvarás e licenças','Fretes e entregas','Outros'] },
];
const expenseCategories = expenseCategoryGroups.flatMap(group => group.items);
function FinanceDashboard({ appointments, expenses, month, setMonth, onAdd, onRemove }) {
  const income = appointments.filter(a=>a.date?.startsWith(month)&&a.status==='Concluído').reduce((sum,a)=>sum+Number(a.total||0),0);
  const monthExpenses = expenses.filter(e=>e.fixedMonthly ? e.date?.slice(0,7)<=month : e.date?.startsWith(month));
  const spent = monthExpenses.reduce((sum,e)=>sum+Number(e.amount||0),0);
  const balance = income-spent;
  const categories = expenseCategories.map(category=>({category,total:monthExpenses.filter(e=>e.category===category).reduce((sum,e)=>sum+Number(e.amount||0),0)})).filter(x=>x.total>0);
  return <section className="management-view report-view"><div className="page-heading"><div><p className="eyebrow">BRAVIO STUDIO · CONTAS DA CASA</p><h1>Financeiro<span className="heading-dot">.</span></h1><p className="muted">Acompanhe entradas, gastos e o resultado do mês.</p></div><div className="report-actions"><MonthPicker month={month} setMonth={setMonth}/><button className="button button-primary" onClick={onAdd}><Plus size={16}/> Registrar despesa</button></div></div><div className="stats-grid report-stats"><Stat icon={ArrowUpRight} label="Receita de serviços" value={money(income)} change="atendimentos concluídos" tone="green"/><Stat icon={ArrowDownRight} label="Despesas do mês" value={money(spent)} change={`${monthExpenses.length} lançamento${monthExpenses.length===1?'':'s'}`} tone="orange"/><Stat icon={Wallet} label="Resultado do mês" value={money(balance)} change={balance>=0?'receita menos despesas':'despesas acima da receita'} tone={balance>=0?'blue':'purple'}/></div><div className="finance-grid"><article className="panel finance-ledger"><div className="report-panel-heading"><div><p className="eyebrow">LANÇAMENTOS</p><h2>Despesas de {monthLabel(month)}</h2></div></div>{monthExpenses.length?<div className="ledger-list">{[...monthExpenses].sort((a,b)=>Number(b.fixedMonthly)-Number(a.fixedMonthly)||b.date.localeCompare(a.date)).map(e=><div className="ledger-row expense-row" key={e.id}><span className="expense-category-icon"><ReceiptCategory category={e.category}/></span><span className="ledger-copy"><b>{e.description||e.category}</b><small>{e.category}{e.fixedMonthly&&<><i> · </i><span className="fixed-tag"><Repeat2 size={10}/>Conta fixa mensal</span></>}</small></span><span className="ledger-date">{e.fixedMonthly?'Mensal':shortDate(e.date)}</span><strong>{money(e.amount)}</strong><button className="row-delete" onClick={()=>onRemove(e.id)} aria-label="Remover despesa"><Trash2 size={14}/></button></div>)}</div>:<EmptyLedger icon={Wallet} title="Nenhuma despesa lançada neste mês" text="Adicione contas, materiais e outros gastos da barbearia."/>}</article><article className="panel category-panel"><div className="report-panel-heading"><div><p className="eyebrow">PARA ONDE VAI</p><h2>Despesas por categoria</h2></div></div>{categories.length?<div className="category-list">{categories.map(item=><div className="category-item" key={item.category}><div className="category-top"><span><ReceiptCategory category={item.category}/>{item.category}</span><b>{money(item.total)}</b></div><div className="category-track"><i style={{width:`${spent?Math.max(item.total/spent*100,3):0}%`}}/></div></div>)}</div>:<div className="category-empty"><span><ReceiptCategory category="Outros"/></span><b>Sem despesas neste período</b><small>Os gastos aparecem aqui agrupados por categoria.</small></div>}<button className="button button-outline full-button" onClick={onAdd}><Plus size={14}/> Adicionar despesa</button></article></div><p className="report-note finance-note">Receita calculada pelos atendimentos marcados como concluídos. Despesas fixas mensais se repetem a partir do mês de cadastro; remova o lançamento para encerrar a recorrência.</p></section>;
}
function ReceiptCategory({ category }) { return <span className={`receipt-cat cat-${category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll(' ','-')}`}><ReceiptIcon category={category}/></span>; }
function ReceiptIcon({ category }) { return category==='Aluguel'||category==='Condomínio'?<House size={15}/>:category==='Água'?<Droplets size={15}/>:category==='Energia elétrica'?<Lightbulb size={15}/>:category==='Internet e telefonia'?<Wifi size={15}/>:category.includes('material')||category.includes('Material')||category.includes('Produtos')?<Package size={15}/>:category==='Manutenção de equipamentos'?<Settings2 size={15}/>:category==='Marketing e publicidade'?<ArrowUpRight size={15}/>:category==='Folha de pagamento e encargos'||category==='Pró-labore'||category==='Comissões de barbeiros'?<Users size={15}/>:<Wallet size={15}/>; }
function EmptyLedger({ icon: Icon, title, text }) { return <div className="empty-ledger"><span><Icon size={20}/></span><b>{title}</b><small>{text}</small></div>; }
function Avatar({ barber, large=false }) { return <span className={`avatar ${large ? 'avatar-large' : ''}`} style={{ '--avatar': barber.color }}>{barber.photo ? <img src={barber.photo} alt={barber.name} /> : initials(barber.name)}</span>; }
function AppointmentRow({ appt, onToggle }) { return <div className="appointment-row"><div className="time-col"><b>{appt.time}</b><span>{appt.duration} min</span></div><span className="timeline"><i /></span><Avatar barber={{ name: appt.barberName, color: appt.barberColor, photo: appt.barberPhoto }} /><div className="appointment-info"><b>{appt.client}</b><span>{appt.services.join(' + ')}</span><small><UserRound size={12} /> {appt.barberName}</small></div><div className="appointment-price"><b>{money(appt.total)}</b>{appt.discount > 0 && <small>desconto de {money(appt.discount)}</small>}</div><button className={`appointment-status ${appt.status === 'Concluído' ? 'done' : ''}`} onClick={onToggle}><i />{appt.status}<ChevronDown size={13} /></button><button className="row-more" aria-label="Mais opções"><MoreHorizontal size={18} /></button></div>; }

function AgendaCalendar({ date, setDate, barbers, appointments, blocks, businessHours, isOpen, search, setSearch, onSelectSlot, onToggleStatus, onBlock, blockOnly=false }) {
  const dayAppointments = appointments.filter(a => a.date === date);
  const dayBlocks = blocks.filter(block => block.date === date);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const hours = businessHours.find(item => Number(item.day) === weekday) || DEFAULT_HOURS[weekday];
  const slots = Array.from({ length: 24 }, (_, i) => i);
  const columns = Math.max(barbers.length, 1);
  const dayOpen = Boolean(hours.isOpen);
  return <section className="panel day-calendar">
    <div className="calendar-toolbar"><div className="calendar-date-controls"><button className="icon-btn" onClick={() => setDate(d => shiftDate(d, -1))} aria-label="Dia anterior"><ChevronLeft size={17}/></button><button className="button button-soft today-button" onClick={() => setDate(todayKey())}>Hoje</button><button className="icon-btn" onClick={() => setDate(d => shiftDate(d, 1))} aria-label="Próximo dia"><ChevronRight size={17}/></button><div className="calendar-date-label"><b>{dateLabel(date)}</b><span>{dayAppointments.length} atendimento{dayAppointments.length === 1 ? '' : 's'} · {dayOpen ? `${hours.open} às ${hours.close}` : 'barbearia fechada'}</span></div></div><div className="calendar-tools">{!blockOnly&&<label className="search-box calendar-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente" /></label>}<button className="button button-outline block-button" onClick={() => onBlock()}><Ban size={14}/> {blockOnly?'Solicitar bloqueio':'Bloquear horário'}</button></div></div>
    {(!isOpen || !dayOpen) && <div className="closed-notice"><Ban size={15}/>{!isOpen?'A agenda da barbearia está fechada.':`A barbearia não abre às ${WEEKDAYS[weekday].toLowerCase()}.`}<span>Edite em Minha barbearia.</span></div>}
    <div className="calendar-scroll"><div className="calendar-grid" style={{ gridTemplateColumns: `64px repeat(${columns}, minmax(175px, 1fr))` }}>
      <div className="calendar-corner">HORÁRIO</div>
      {barbers.length ? barbers.map(barber => <div className="barber-calendar-heading" key={barber.id}><Avatar barber={barber}/><span><b>{barber.name}</b><small>{barber.role}</small></span></div>) : <div className="barber-calendar-heading">Cadastre um barbeiro para montar a agenda</div>}
      <div className="time-labels">{slots.map(i => <div className={`time-label ${i % 2 ? 'half-label' : ''}`} key={i}>{i % 2 === 0 ? `${String(8 + i/2).padStart(2,'0')}:00` : '·'}</div>)}</div>
      {barbers.map(barber => {
        const barberAppointments = dayAppointments.filter(a => a.barberId === barber.id).sort((a,b) => a.time.localeCompare(b.time));
        const barberBlocks = dayBlocks.filter(block => !block.barberId || block.barberId === barber.id);
        return <div className="barber-day-column" key={barber.id} style={{ '--barber-color': barber.color }}>
          {slots.map(i => {
            const start = 8 * 60 + i * 30;
            const withinHours = dayOpen && start >= timeMinutes(hours.open) && start + 30 <= timeMinutes(hours.close);
            const appointmentBusy = barberAppointments.some(a => start < timeMinutes(a.time) + a.duration && timeMinutes(a.time) < start + 30);
            const blockBusy = barberBlocks.some(block => start < timeMinutes(block.end) && timeMinutes(block.start) < start + 30);
            const disabled = !isOpen || !withinHours || appointmentBusy || blockBusy;
            const time = `${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`;
            return <button key={time} className={`calendar-slot ${disabled ? 'occupied' : ''} ${!withinHours || !isOpen ? 'outside-hours' : ''}`} disabled={disabled} onClick={() => onSelectSlot(barber, time)} title={disabled ? 'Horário fechado ou ocupado' : blockOnly?`Solicitar bloqueio a partir de ${time}`:`Agendar às ${time}`} aria-label={disabled ? `Horário ${time} indisponível` : `${blockOnly?'Solicitar bloqueio':'Agendar'} ${barber.name} às ${time}`} />;
          })}
          {barberBlocks.map(block => {
            const start = Math.max(timeMinutes(block.start), 8 * 60); const end = Math.min(timeMinutes(block.end), 20 * 60); if (end <= start) return null;
            const scope = block.barberId ? block.barberName : 'Toda a equipe';
            return <div key={block.id} className="calendar-block" style={{ top: `${(start-8*60)*2}px`, height: `${Math.max((end-start)*2,32)}px` }} title={`${block.reason} · ${block.start}–${block.end}`}><b><Ban size={11}/>{block.reason}</b><small>{block.start}–{block.end} · {scope}</small></div>;
          })}
          {barberAppointments.map(appt => {
            const start = timeMinutes(appt.time); const top = (start - 8 * 60) * 2; const height = Math.max(appt.duration * 2, 46);
            const matches = !search || `${appt.client} ${appt.barberName} ${appt.services.join(' ')}`.toLowerCase().includes(search.toLowerCase());
            return <button key={appt.id} className={`calendar-event ${appt.status === 'Concluído' ? 'event-done' : ''} ${matches ? '' : 'event-dimmed'}`} style={{ top: `${top}px`, height: `${height}px` }} onClick={blockOnly?undefined:()=>onToggleStatus(appt.id)} title={`${appt.client} · ${appt.time} · ${appt.duration} min${blockOnly?'':' · clique para alterar status'}`}><span className="event-time">{appt.time}–{`${String(Math.floor((start+appt.duration)/60)).padStart(2,'0')}:${String((start+appt.duration)%60).padStart(2,'0')}`}</span><b>{appt.client}</b><span className="event-service">{appt.services.join(' + ')}</span><small>{appt.status}</small></button>;
          })}
        </div>;
      })}
    </div></div>
    <div className="calendar-legend"><span><i className="legend-free"/>Livre</span><span><i className="legend-booked"/>Agendado</span><span><i className="legend-blocked"/>Bloqueado / fechado</span><small>{blockOnly?'Toque em um horário livre para solicitar bloqueio.':'Toque em um horário livre para agendar.'}</small></div>
  </section>;
}

function BlockRequestsPanel({requests,onReview}) {
  return <section className="panel block-request-panel"><div className="report-panel-heading"><div><p className="eyebrow">PEDIDOS DA EQUIPE</p><h2><Bell size={15}/> Solicitações de bloqueio <span className="request-total">{requests.length}</span></h2></div><span className="request-live"><i/> Pendentes</span></div><div className="block-request-list">{[...requests].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).map(request=><article className="block-request-row" key={request.id}><span className="block-list-icon"><Ban size={15}/></span><div className="block-request-copy"><b>{request.barberName} <span>· {request.reason}</span></b><small>{shortDate(request.date)} · {request.start}–{request.end}</small></div><div className="block-request-actions"><button className="request-approve" onClick={()=>onReview(request.id,'Aprovado')}><CheckCircle2 size={14}/> Aprovar</button><button className="request-reject" onClick={()=>onReview(request.id,'Recusado')}><XCircle size={14}/> Recusar</button></div></article>)}</div></section>;
}

function BarberPortal({barber,data,onRequestBlock,onSignOut}) {
  const [page,setPage]=useState('Agenda');const [date,setDate]=useState(todayKey());const [month,setMonth]=useState(currentMonthKey());const [requestModal,setRequestModal]=useState(false);const [defaults,setDefaults]=useState({date:todayKey(),time:'12:00'});const [toast,setToast]=useState('');
  const ownAppointments=data.appointments.filter(item=>item.barberId===barber.id);
  const ownRequests=(data.blockRequests||[]).filter(item=>item.barberId===barber.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  function openRequest(requestDate,time){setDefaults({date:requestDate||date,time:time||'12:00'});setRequestModal(true);}
  async function submitRequest(request){try{await onRequestBlock({...request,barberId:barber.id,barberName:barber.name});setRequestModal(false);setToast('Pedido enviado ao gerente');}catch(error){setToast('Não foi possível enviar o pedido: '+error.message);}window.setTimeout(()=>setToast(''),3500);}
  return <div className="barber-portal"><header className="barber-portal-header"><a className="brand" href="#barber-home"><span className="brand-symbol"><Scissors size={19}/></span><span>bravio<small>BARBERSHOP</small></span></a><div className="barber-portal-user"><Avatar barber={barber}/><span><b>{barber.name}</b><small>Acesso do barbeiro</small></span><button className="button button-soft" onClick={onSignOut}><LogOut size={15}/> Sair</button></div></header><main className="barber-portal-main"><div className="barber-portal-tabs"><button className={page==='Agenda'?'active':''} onClick={()=>setPage('Agenda')}><CalendarDays size={15}/> Minha agenda</button><button className={page==='Meu desempenho'?'active':''} onClick={()=>setPage('Meu desempenho')}><BarChart3 size={15}/> Meu desempenho</button></div><section className="page-heading"><div><p className="eyebrow">ÁREA DO BARBEIRO</p><h1>{page==='Agenda'?'Minha agenda':'Meu desempenho'}<span className="heading-dot">.</span></h1><p className="muted">{page==='Agenda'?'Confira seus horários e solicite bloqueios ao gerente.':'Acompanhe seus atendimentos e valores neste mês.'}</p></div>{page==='Agenda'&&<button className="button button-primary" onClick={()=>openRequest(date,'12:00')}><Ban size={15}/> Solicitar bloqueio</button>}</section>{page==='Agenda'?<><AgendaCalendar date={date} setDate={setDate} barbers={[barber]} appointments={ownAppointments} blocks={data.businessBlocks||[]} businessHours={data.businessHours||DEFAULT_HOURS} isOpen={data.open} search="" setSearch={()=>{}} onSelectSlot={(_,time)=>openRequest(date,time)} onToggleStatus={()=>{}} onBlock={()=>openRequest(date,'12:00')} blockOnly/><section className="panel barber-own-requests"><div className="report-panel-heading"><div><p className="eyebrow">ACOMPANHAMENTO</p><h2>Meus pedidos de bloqueio</h2></div></div>{ownRequests.length?<div className="ledger-list">{ownRequests.map(request=><div className="ledger-row" key={request.id}><span className={'request-status-icon '+(request.status==='Aprovado'?'approved':request.status==='Recusado'?'rejected':'')}><Ban size={15}/></span><span className="ledger-copy"><b>{request.reason} · {request.start}–{request.end}</b><small>{shortDate(request.date)}</small></span><span className={'request-status-text '+request.status.toLowerCase()}>{request.status}</span></div>)}</div>:<EmptyLedger icon={Bell} title="Nenhum pedido por enquanto" text="Quando precisar de um horário indisponível, solicite pelo calendário."/>}</section></>:<BarberPersonalDashboard barber={barber} appointments={ownAppointments} withdrawals={(data.withdrawals||[]).filter(item=>item.barberId===barber.id)} month={month} setMonth={setMonth}/>}</main>{requestModal&&<BlockRequestModal barber={barber} defaults={defaults} businessHours={data.businessHours||DEFAULT_HOURS} appointments={ownAppointments} blocks={data.businessBlocks||[]} requests={ownRequests} onClose={()=>setRequestModal(false)} onSave={submitRequest}/ >}{toast&&<div className="toast"><Check size={15}/>{toast}</div>}</div>;
}

function BlockRequestModal({barber,defaults,businessHours,appointments,blocks,requests,onClose,onSave}) {
  const [date,setDate]=useState(defaults.date);const [start,setStart]=useState(defaults.time);const [end,setEnd]=useState(addTime(defaults.time,30));const [reason,setReason]=useState('Pausa');const [error,setError]=useState('');
  const weekday=new Date(date+'T12:00:00').getDay();const hours=businessHours.find(item=>Number(item.day)===weekday)||DEFAULT_HOURS[weekday];const starts=hours.isOpen?timeSlots.filter(time=>timeMinutes(time)>=timeMinutes(hours.open)&&timeMinutes(time)<timeMinutes(hours.close)):[];const validStart=starts.includes(start)?start:(starts[0]||'');const ends=validStart?timeSlots.filter(time=>timeMinutes(time)>timeMinutes(validStart)&&timeMinutes(time)<=timeMinutes(hours.close)):[];const validEnd=ends.includes(end)?end:(ends[0]||'');
  function submit(event){event.preventDefault();if(!hours.isOpen)return setError('A barbearia está fechada neste dia.');if(!validStart||!validEnd)return setError('Escolha um período dentro do horário de funcionamento.');const from=timeMinutes(validStart),to=timeMinutes(validEnd);const appt=appointments.find(item=>item.date===date&&from<timeMinutes(item.time)+item.duration&&timeMinutes(item.time)<to);if(appt)return setError('O período conflita com um atendimento às '+appt.time+'.');const blocked=blocks.find(item=>item.date===date&&(!item.barberId||item.barberId===barber.id)&&from<timeMinutes(item.end)&&timeMinutes(item.start)<to);if(blocked)return setError('Este período já está bloqueado na agenda.');const pending=requests.find(item=>item.date===date&&item.status==='Pendente'&&from<timeMinutes(item.end)&&timeMinutes(item.start)<to);if(pending)return setError('Você já tem um pedido pendente neste período.');onSave({date,start:validStart,end:validEnd,reason:reason.trim()||'Indisponível'});}
  return <ModalShell title="Solicitar bloqueio" subtitle={'O pedido será enviado ao gerente para aprovação · '+barber.name+'.'} onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Data<input type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label><div className="form-two"><label>Início<select value={validStart} onChange={event=>{setStart(event.target.value);setEnd(addTime(event.target.value,30));}} disabled={!starts.length}>{starts.length?starts.map(time=><option key={time}>{time}</option>):<option>Barbearia fechada</option>}</select></label><label>Fim<select value={validEnd} onChange={event=>setEnd(event.target.value)} disabled={!ends.length}>{ends.length?ends.map(time=><option key={time}>{time}</option>):<option>—</option>}</select></label></div><label>Motivo<input value={reason} onChange={event=>setReason(event.target.value)} placeholder="Ex.: compromisso ou consulta"/></label><p className="field-hint">O horário só será bloqueado na agenda depois que o gerente aprovar.</p>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={!starts.length||!ends.length}><Bell size={14}/> Enviar solicitação</button></div></form></ModalShell>;
}

function BarberPersonalDashboard({barber,appointments,withdrawals,month,setMonth}) {
  const completed=appointments.filter(item=>item.date?.startsWith(month)&&item.status==='Concluído');const gross=completed.reduce((sum,item)=>sum+Number(item.total||0),0);const commission=barber.commission==null?null:gross*Number(barber.commission)/100;const takes=withdrawals.filter(item=>item.date?.startsWith(month));const taken=takes.reduce((sum,item)=>sum+Number(item.amount||0),0);const balance=commission==null?null:commission-taken;
  return <section className="management-view report-view"><div className="report-actions personal-month"><MonthPicker month={month} setMonth={setMonth}/></div><div className="stats-grid report-stats"><Stat icon={Check} label="Atendimentos concluídos" value={String(completed.length)} change={monthLabel(month)} tone="green"/><Stat icon={DollarSign} label="Em serviços" value={money(gross)} change="seus atendimentos no período" tone="blue"/><Stat icon={Wallet} label="Sua comissão" value={commission==null?'Definir com gerente':money(commission)} change={barber.commission==null?'percentual não configurado':barber.commission+'% sobre serviços'} tone="purple"/><Stat icon={ArrowDownRight} label="Saldo estimado" value={balance==null?'—':money(balance)} change={money(taken)+' em retiradas'} tone="orange"/></div><article className="panel personal-work-panel"><div className="report-panel-heading"><div><p className="eyebrow">SEU TRABALHO</p><h2>Atendimentos concluídos</h2></div><span className="report-period">{monthLabel(month)}</span></div>{completed.length?<div className="ledger-list">{[...completed].sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)).map(item=><div className="ledger-row" key={item.id}><span className="ledger-icon"><Check size={15}/></span><span className="ledger-copy"><b>{item.client}</b><small>{shortDate(item.date)} · {item.time} · {item.services.join(' + ')}</small></span><strong>{money(item.total)}</strong></div>)}</div>:<EmptyLedger icon={CalendarDays} title="Nenhum atendimento concluído neste mês" text="Seus serviços finalizados aparecerão aqui."/>}</article></section>;
}

function ShopLogo({ data }) { return <span className="shop-avatar">{data.shopLogo?<img src={data.shopLogo} alt=""/>:<Store size={17}/>}</span>; }
function BusinessSettings({ data, update, onSave, onAddBlock, onRemoveBlock }) {
  const [shopName,setShopName]=useState(data.shopName||'Bravio Studio');const [hours,setHours]=useState(data.businessHours||DEFAULT_HOURS);const [message,setMessage]=useState('');const hourOptions=timeSlots;const startOptions=timeSlots.slice(0,-1);
  function updateDay(day,patch){setHours(previous=>previous.map(item=>Number(item.day)===day?{...item,...patch}:item));setMessage('');}
  function uploadLogo(e){const file=e.target.files?.[0];if(!file)return;if(file.size>2_000_000){setMessage('A logo precisa ter até 2 MB.');return;}const reader=new FileReader();reader.onload=()=>{update('shopLogo',reader.result);setMessage('Logo atualizada.');};reader.readAsDataURL(file);}
  function submit(e){e.preventDefault();onSave({shopName,businessHours:hours});setMessage('Horários e dados da barbearia salvos.');}
  const sortedBlocks=[...(data.businessBlocks||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  return <section className="management-view business-view"><div className="page-heading"><div><p className="eyebrow">PERFIL E DISPONIBILIDADE</p><h1>Minha barbearia<span className="heading-dot">.</span></h1><p className="muted">Logo, horário de funcionamento e bloqueios da agenda.</p></div></div><div className="business-settings-grid"><article className="panel shop-profile-panel"><div className="report-panel-heading"><div><p className="eyebrow">IDENTIDADE DA CASA</p><h2>Perfil da barbearia</h2></div></div><div className="shop-logo-row"><label className="shop-logo-picker"><ShopLogo data={data}/><input type="file" accept="image/*" onChange={uploadLogo}/><span><ImagePlus size={14}/></span></label><div><b>Logo da barbearia</b><small>JPG ou PNG, até 2 MB.</small><label className="upload-link">{data.shopLogo?'Trocar logo':'Enviar logo'}<input type="file" accept="image/*" onChange={uploadLogo}/></label></div>{data.shopLogo&&<button className="row-delete" onClick={()=>{update('shopLogo','');setMessage('Logo removida.');}} aria-label="Remover logo"><Trash2 size={14}/></button>}</div><form className="modal-form shop-name-form" onSubmit={submit}><label>Nome da barbearia<input value={shopName} onChange={e=>{setShopName(e.target.value);setMessage('');}} placeholder="Ex.: Bravio Studio" /></label>{message&&<small className="shop-settings-message">{message}</small>}<button className="button button-primary"><Check size={15}/> Salvar dados</button></form></article>
    <article className="panel hours-panel"><div className="report-panel-heading"><div><p className="eyebrow">ABERTURA DA BARBEARIA</p><h2>Horário de funcionamento</h2></div><Clock3 size={17} className="panel-heading-icon"/></div><form className="hours-form" onSubmit={submit}>{WEEKDAYS.map((day,index)=>{const row=hours.find(item=>Number(item.day)===index)||DEFAULT_HOURS[index];const closes=hourOptions.filter(t=>timeMinutes(t)>timeMinutes(row.open));return <div className={`hours-row ${row.isOpen?'':'hours-closed'}`} key={day}><label className="hours-day-toggle"><input type="checkbox" checked={row.isOpen} onChange={e=>updateDay(index,{isOpen:e.target.checked})}/><span className="switch-track"><i/></span><b>{day}</b></label>{row.isOpen?<div className="hours-times"><select aria-label={`${day}: abre`} value={row.open} onChange={e=>{const open=e.target.value;const close=timeMinutes(row.close)<=timeMinutes(open)?(hourOptions.find(t=>timeMinutes(t)>timeMinutes(open))||'20:00'):row.close;updateDay(index,{open,close});}}>{startOptions.map(t=><option key={t}>{t}</option>)}</select><span>às</span><select aria-label={`${day}: fecha`} value={row.close} onChange={e=>updateDay(index,{close:e.target.value})}>{closes.map(t=><option key={t}>{t}</option>)}</select></div>:<span className="closed-day-label">Fechado</span>}</div>;})}<div className="hours-form-bottom"><small>Os horários livres da agenda seguem esta configuração. Os intervalos são de 30 minutos.</small><button className="button button-primary"><Check size={15}/> Salvar horários</button></div></form></article>
    <article className="panel blocks-panel"><div className="report-panel-heading"><div><p className="eyebrow">INDISPONIBILIDADES</p><h2>Bloqueios de agenda</h2></div><button className="button button-primary button-small" onClick={onAddBlock}><Plus size={14}/> Novo bloqueio</button></div>{sortedBlocks.length?<div className="business-block-list">{sortedBlocks.map(block=><div className="business-block-row" key={block.id}><span className="block-list-icon"><Ban size={15}/></span><span className="ledger-copy"><b>{block.reason}</b><small>{shortDate(block.date)} · {block.barberId?block.barberName:'Toda a equipe'}</small></span><strong>{block.start}–{block.end}</strong><button className="row-delete" onClick={()=>onRemoveBlock(block.id)} aria-label="Remover bloqueio"><Trash2 size={14}/></button></div>)}</div>:<EmptyLedger icon={Ban} title="Nenhum bloqueio cadastrado" text="Bloqueie pausas, feriados, folgas ou períodos em que alguém não vai atender."/>}</article>
  </div></section>;
}

function AppointmentModal({ data, defaults, businessHours, blocks, agendaOpen, onSwitchTab, onClose, onSave, embedded=false, onContextChange }) {
  const [client, setClient] = useState(''); const [phone, setPhone] = useState(''); const [barberId, setBarberId] = useState(defaults.barberId || data.barbers[0]?.id || ''); const [date, setDate] = useState(defaults.date || todayKey()); const [time, setTime] = useState(defaults.time || '09:00'); const [selected, setSelected] = useState([]); const [discount, setDiscount] = useState(''); const [error, setError] = useState('');
  useEffect(()=>{setDate(defaults.date||todayKey());setTime(defaults.time||'09:00');setBarberId(defaults.barberId||data.barbers[0]?.id||'');},[defaults.date,defaults.time,defaults.barberId]);
  const barber = data.barbers.find(b => b.id === barberId); const subtotal = data.services.filter(s => selected.includes(s.id)).reduce((n,s) => n+s.price,0); const total = Math.max(0, subtotal - (Number(discount)||0)); const duration = data.services.filter(s => selected.includes(s.id)).reduce((n,s) => n+s.duration,0);
  const weekday = new Date(`${date}T12:00:00`).getDay(); const hours = businessHours.find(item=>Number(item.day)===weekday) || DEFAULT_HOURS[weekday];
  const availableTimes = agendaOpen && hours.isOpen ? timeSlots.filter(slot=>{const start=timeMinutes(slot);const serviceDuration=Math.max(duration,30);if(start<timeMinutes(hours.open)||start+serviceDuration>timeMinutes(hours.close))return false;const busy=data.appointments.some(a=>a.date===date&&a.barberId===barberId&&start<timeMinutes(a.time)+a.duration&&timeMinutes(a.time)<start+serviceDuration);const blocked=blocks.some(b=>b.date===date&&(!b.barberId||b.barberId===barberId)&&start<timeMinutes(b.end)&&timeMinutes(b.start)<start+serviceDuration);return !busy&&!blocked;}) : [];
  const selectedTime=availableTimes.includes(time)?time:(availableTimes[0]||'');
  const toggleService = (id) => setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v,id]);
  function submit(e) { e.preventDefault(); if (!client.trim()) return setError('Informe o nome do cliente.'); if (!selected.length) return setError('Selecione pelo menos um serviço.'); if (!barber) return setError('Cadastre um barbeiro antes de criar um atendimento.'); if (!agendaOpen) return setError('A agenda da barbearia está fechada.'); if (!hours.isOpen) return setError('A barbearia não abre neste dia.'); if (!selectedTime) return setError('Não há horário livre para este barbeiro neste dia.'); if (Number(discount) > subtotal) return setError('O desconto não pode ser maior que o valor dos serviços.'); const start = timeMinutes(selectedTime); const conflict = data.appointments.find(a => a.date === date && a.barberId === barberId && start < timeMinutes(a.time) + a.duration && timeMinutes(a.time) < start + duration); if (conflict) return setError(`Esse horário conflita com ${conflict.client}, às ${conflict.time}.`); const block=blocks.find(b=>b.date===date&&(!b.barberId||b.barberId===barberId)&&start<timeMinutes(b.end)&&timeMinutes(b.start)<start+duration);if(block)return setError(`Este horário está bloqueado: ${block.reason}.`); onSave({ client: client.trim(), phone, barberId, barberName: barber.name, barberColor: barber.color, barberPhoto: barber.photo, date, time:selectedTime, services: data.services.filter(s=>selected.includes(s.id)).map(s=>s.name), subtotal, discount: Number(discount)||0, total, duration, status: 'Agendado' }); }
  const formContent = <form className="modal-form" onSubmit={submit}><div className="form-two"><label>Nome do cliente<input autoFocus placeholder="Ex.: Pedro Almeida" value={client} onChange={e=>setClient(e.target.value)} /></label><label>Telefone <span className="optional">(opcional)</span><input type="tel" inputMode="numeric" placeholder="(61) 9 9999-9999" value={phone} onChange={e=>setPhone(phoneMask(e.target.value))} /></label></div><div className="form-two"><label>Data<input type="date" value={date} onChange={e=>{const v=e.target.value;setDate(v);onContextChange?.({date:v});}} /></label><label>Horário<select value={selectedTime} onChange={e=>{const v=e.target.value;setTime(v);onContextChange?.({time:v});}} disabled={!availableTimes.length}>{availableTimes.length?availableTimes.map(slot=><option key={slot} value={slot}>{slot}</option>):<option value="">Sem horários disponíveis</option>}</select><span className="field-hint">Horários livres conforme funcionamento e bloqueios</span></label></div><label>Barbeiro<select value={barberId} onChange={e=>{const v=e.target.value;setBarberId(v);onContextChange?.({barberId:v});}}>{data.barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><fieldset className="service-picker"><legend>Serviços <span>Selecione um ou mais</span></legend>{data.services.map(s=><label className={`service-option ${selected.includes(s.id)?'checked':''}`} key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleService(s.id)} /><span className="fake-check"><Check size={12} /></span><span className="service-option-name"><b>{s.name}</b><small>{s.duration} min</small></span><strong>{money(s.price)}</strong></label>)}</fieldset><div className="form-two discount-total"><label>Desconto <span className="optional">(R$)</span><input type="number" min="0" step="0.01" placeholder="0,00" value={discount} onChange={e=>setDiscount(e.target.value)} /></label><div className="total-box"><span>{selected.length} serviço{selected.length===1?'':'s'} · {duration} min</span><b>{money(total)}</b><small>Subtotal {money(subtotal)}{Number(discount)>0?` − ${money(Number(discount))}`:''}</small></div></div>{error && <p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit"><Check size={16} /> Confirmar atendimento</button></div></form>;
  return embedded ? formContent : <ModalShell title="Novo atendimento" subtitle="Preencha os detalhes para reservar um horário." onClose={onClose}><CalendarActionTabs active="appointment" onSwitch={onSwitchTab}/>{formContent}</ModalShell>;
}

function BarberModal({ barber, barbers=[], cloudEnabled=false, onClose, onSave }) {
  const hasAccess=Boolean(cloudEnabled?barber?.accessEmail:barber?.access||barber?.accessEmail);
  const [name,setName]=useState(barber?.name||''); const [role,setRole]=useState(barber?.role||'Barbeiro'); const [color,setColor]=useState(barber?.color||PALETTE[0]); const [photo,setPhoto]=useState(barber?.photo||''); const [commission,setCommission]=useState(barber?.commission==null?'':String(barber.commission)); const [accessEmail,setAccessEmail]=useState(barber?.accessEmail||barber?.access?.email||'');const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  function fileChange(e) { const file=e.target.files?.[0]; if(!file)return; if(file.size>2_000_000){setError('Escolha uma imagem de até 2 MB.');return;} const reader=new FileReader(); reader.onload=()=>setPhoto(reader.result); reader.readAsDataURL(file); }
  return <ModalShell title={barber?'Editar barbeiro':'Cadastrar barbeiro'} subtitle={barber?cloudEnabled&&!hasAccess?'Complete o perfil e envie o convite de acesso.':'Atualize o perfil, a comissão e o acesso individual.':cloudEnabled?'Adicione o barbeiro e envie um convite seguro por e-mail.':'Adicione alguém novo ao time e configure o acesso individual.'} onClose={onClose}><form className="modal-form" onSubmit={async e=>{e.preventDefault();setError('');if(!name.trim()){setError('Informe o nome do barbeiro.');return;}if(commission===''||Number(commission)<0||Number(commission)>100){setError('Informe uma comissão entre 0% e 100%.');return;}const email=accessEmail.trim().toLowerCase();if((email||password)&&!email){setError('Informe o e-mail para configurar o acesso.');return;}if(!cloudEnabled&&email&&!hasAccess&&!password){setError('Defina uma senha inicial para este acesso.');return;}if(hasAccess&&!email){setError('Mantenha um e-mail ou configure outra conta antes de salvar.');return;}if(password&&password.length<8){setError('A senha precisa ter pelo menos 8 caracteres.');return;}if(email&&barbers.some(item=>item.id!==barber?.id&&(item.access?.email||item.accessEmail)===email)){setError('Este e-mail já está vinculado a outro barbeiro.');return;}setLoading(true);try{await onSave({id:barber?.id,name:name.trim(),role,color,photo,commission:Number(commission),accessEmail:email,password});}catch(reason){setError(reason?.message||'Não foi possível salvar o barbeiro ou enviar o convite.');}finally{setLoading(false);}}}><div className="photo-upload"><label className="photo-preview" style={{'--avatar':color}}>{photo?<img src={photo} alt="Prévia"/>:initials(name||'Novo barbeiro')}<input type="file" accept="image/*" onChange={fileChange} /></label><div><b>Foto do barbeiro</b><small>JPG ou PNG, até 2 MB</small><label className="upload-link">Escolher imagem<input type="file" accept="image/*" onChange={fileChange}/></label></div></div><label>Nome completo<input autoFocus placeholder="Ex.: Rafael Costa" value={name} onChange={e=>setName(e.target.value)} /></label><label>Função<select value={role} onChange={e=>setRole(e.target.value)}><option>Barbeiro</option><option>Barbeiro sênior</option><option>Barbeiro aprendiz</option><option>Gerente</option></select></label><label>Porcentagem recebida por serviço (%)<input type="number" min="0" max="100" step="0.01" placeholder="Ex.: 50" value={commission} onChange={e=>setCommission(e.target.value)} required/><span className="field-hint">Aplicada ao valor final dos atendimentos concluídos.</span></label><div className="access-form-heading"><LockKeyhole size={14}/><span><b>Acesso do barbeiro</b><small>Ele verá apenas a própria agenda e os próprios valores.</small></span></div><label>E-mail de acesso{!hasAccess&&!cloudEnabled&&<span className="optional">(opcional)</span>}<input type="email" autoComplete="off" placeholder="barbeiro@barbearia.com" value={accessEmail} onChange={e=>setAccessEmail(e.target.value)} required={Boolean(hasAccess||cloudEnabled)}/></label>{!cloudEnabled&&!barber&&<p className="field-hint">No modo local, o acesso usa uma senha inicial. Convites por e-mail exigem Supabase configurado.</p>}{cloudEnabled&&!hasAccess?<p className="field-hint">Enviaremos um convite para este e-mail. O barbeiro cria a própria senha pelo link.</p>:<label>{hasAccess?'Nova senha (opcional)':'Senha inicial (opcional)'}<input type="password" autoComplete="new-password" placeholder={hasAccess?'Deixe em branco para manter':'Mínimo de 8 caracteres'} value={password} onChange={e=>setPassword(e.target.value)}/></label>}<div className="color-picker-label">Cor de identificação</div><div className="color-picker">{PALETTE.map(c=><button type="button" key={c} style={{background:c}} className={color===c?'selected':''} onClick={()=>setColor(c)} aria-label={`Cor ${c}`}>{color===c&&<Check size={14}/>}</button>)}</div>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={loading}>{loading?'Aguarde…':barber?'Salvar alterações':cloudEnabled?'Salvar e enviar convite':'Cadastrar barbeiro'}</button></div></form></ModalShell>;
}

function ServiceModal({ onClose, onSave }) {
  const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [duration, setDuration] = useState('30'); const [error, setError] = useState('');
  function submit(e) { e.preventDefault(); if (!name.trim()) return setError('Informe o nome do serviço.'); if (!price || Number(price) <= 0) return setError('Informe um preço maior que zero.'); onSave({ name: name.trim(), price: Number(price), duration: Number(duration) }); }
  return <ModalShell title="Adicionar serviço" subtitle="Inclua uma opção no cardápio da barbearia." onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Nome do serviço<input autoFocus placeholder="Ex.: Corte clássico" value={name} onChange={e=>setName(e.target.value)} /></label><div className="form-two"><label>Preço (R$)<input type="number" min="0.01" step="0.01" placeholder="45,00" value={price} onChange={e=>setPrice(e.target.value)} /></label><label>Duração<select value={duration} onChange={e=>setDuration(e.target.value)}>{[10,15,20,25,30,35,40,45,50,55,60,75,90,120].map(v=><option key={v} value={v}>{v} minutos</option>)}</select></label></div>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit"><Plus size={16}/> Salvar serviço</button></div></form></ModalShell>;
}

function BlockModal({ barbers, businessHours, defaults={date:todayKey(),time:'12:00',barberId:''}, onSwitchTab, onClose, onSave, embedded=false, onContextChange }) {
  const [date,setDate]=useState(defaults.date||todayKey());const [barberId,setBarberId]=useState(defaults.barberId||'');const [start,setStart]=useState(defaults.time||'12:00');const [end,setEnd]=useState(addTime(defaults.time||'12:00',30));const [reason,setReason]=useState('Pausa');const [error,setError]=useState('');
  useEffect(()=>{setDate(defaults.date||todayKey());setBarberId(defaults.barberId||'');setStart(defaults.time||'12:00');setEnd(addTime(defaults.time||'12:00',30));},[defaults.date,defaults.time,defaults.barberId]);
  const weekday=new Date(`${date}T12:00:00`).getDay();const hours=businessHours.find(item=>Number(item.day)===weekday)||DEFAULT_HOURS[weekday];
  const starts=timeSlots.slice(0,-1).filter(t=>hours.isOpen&&timeMinutes(t)>=timeMinutes(hours.open)&&timeMinutes(t)<timeMinutes(hours.close));
  const effectiveStart=starts.includes(start)?start:(starts[0]||'');
  const ends=timeSlots.filter(t=>effectiveStart&&timeMinutes(t)>timeMinutes(effectiveStart)&&timeMinutes(t)<=timeMinutes(hours.close));
  const effectiveEnd=ends.includes(end)?end:(ends[0]||'');
  function submit(e){e.preventDefault();if(!hours.isOpen)return setError('A barbearia está fechada neste dia.');if(!effectiveStart||!effectiveEnd)return setError('Escolha um intervalo dentro do horário de funcionamento.');const barber=barbers.find(b=>b.id===barberId);onSave({date,barberId,barberName:barber?.name||'',start:effectiveStart,end:effectiveEnd,reason:reason.trim()||'Indisponível'});}
  const formContent = <form className="modal-form" onSubmit={submit}><label>Data<input type="date" value={date} onChange={e=>{const v=e.target.value;setDate(v);onContextChange?.({date:v});}} required/></label><label>Quem ficará indisponível?<select value={barberId} onChange={e=>{const v=e.target.value;setBarberId(v);onContextChange?.({barberId:v});}}><option value="">Toda a equipe</option>{barbers.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label><div className="form-two"><label>Início<select value={effectiveStart} onChange={e=>{const v=e.target.value;setStart(v);onContextChange?.({time:v});}} disabled={!starts.length}>{starts.length?starts.map(t=><option key={t}>{t}</option>):<option>Barbearia fechada</option>}</select></label><label>Fim<select value={effectiveEnd} onChange={e=>setEnd(e.target.value)} disabled={!ends.length}>{ends.length?ends.map(t=><option key={t}>{t}</option>):<option>—</option>}</select></label></div><label>Motivo<input placeholder="Ex.: almoço, folga ou compromisso" value={reason} onChange={e=>setReason(e.target.value)} /></label><p className="field-hint">O bloqueio impede novos agendamentos nesse intervalo.</p>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={!starts.length||!ends.length}><Ban size={14}/> Confirmar bloqueio</button></div></form>;
  return embedded ? formContent : <ModalShell title="Bloquear horário" subtitle="Marque um período como indisponível na agenda." onClose={onClose}><CalendarActionTabs active="block" onSwitch={onSwitchTab}/>{formContent}</ModalShell>;
}

function CalendarActionModal({data,defaults,defaultTab,businessHours,blocks,agendaOpen,barbers,onClose,onSaveAppointment,onSaveBlock}) {
  const [activeTab,setActiveTab]=useState(defaultTab);
  const [context,setContext]=useState(defaults);
  const updateContext=patch=>setContext(current=>({...current,...patch}));
  return <ModalShell title="Agenda da barbearia" subtitle="Escolha entre reservar um atendimento ou bloquear um período." onClose={onClose}><CalendarActionTabs active={activeTab} onSwitch={setActiveTab}/><div hidden={activeTab!=="appointment"}><AppointmentModal embedded data={data} defaults={context} businessHours={businessHours} blocks={blocks} agendaOpen={agendaOpen} onContextChange={updateContext} onClose={onClose} onSave={onSaveAppointment}/></div><div hidden={activeTab!=="block"}><BlockModal embedded barbers={barbers} businessHours={businessHours} defaults={context} onContextChange={updateContext} onClose={onClose} onSave={onSaveBlock}/></div></ModalShell>;
}

function CalendarActionTabs({active,onSwitch}) { return <div className="calendar-action-tabs"><button className={active==='appointment'?'active':''} onClick={()=>active!=='appointment'&&onSwitch?.('appointment')} type="button"><CalendarDays size={14}/>Agendamento</button><button className={active==='block'?'active':''} onClick={()=>active!=='block'&&onSwitch?.('block')} type="button"><Ban size={14}/>Bloqueio</button></div>; }

function WithdrawalModal({ barbers, onClose, onSave }) {
  const [barberId,setBarberId]=useState(barbers[0]?.id||'');const [type,setType]=useState('Adiantamento');const [amount,setAmount]=useState('');const [date,setDate]=useState(todayKey());const [note,setNote]=useState('');const [error,setError]=useState('');
  function submit(e){e.preventDefault();const barber=barbers.find(b=>b.id===barberId);if(!barber)return setError('Cadastre um barbeiro antes de registrar uma retirada.');if(Number(amount)<=0)return setError('Informe um valor maior que zero.');onSave({barberId,barberName:barber.name,type,amount:Number(amount),date,note:note.trim()});}
  return <ModalShell title="Registrar retirada" subtitle="Lance um vale, adiantamento ou outra retirada do barbeiro." onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Barbeiro<select value={barberId} onChange={e=>setBarberId(e.target.value)}>{barbers.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label><div className="form-two"><label>Tipo<select value={type} onChange={e=>setType(e.target.value)}><option>Adiantamento</option><option>Vale</option><option>Retirada</option></select></label><label>Valor (R$)<input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)}/></label></div><div className="form-two"><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Observação <span className="optional">(opcional)</span><input placeholder="Ex.: vale da semana" value={note} onChange={e=>setNote(e.target.value)}/></label></div>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary"><Check size={15}/> Salvar retirada</button></div></form></ModalShell>;
}

function ExpenseModal({ onClose, onSave }) {
  const [category,setCategory]=useState('Aluguel');const [description,setDescription]=useState('');const [amount,setAmount]=useState('');const [date,setDate]=useState(todayKey());const [fixedMonthly,setFixedMonthly]=useState(false);const [error,setError]=useState('');
  function submit(e){e.preventDefault();if(Number(amount)<=0)return setError('Informe um valor maior que zero.');onSave({category,description:description.trim(),amount:Number(amount),date,fixedMonthly});}
  return <ModalShell title="Registrar despesa" subtitle="Organize as contas e os gastos da barbearia." onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}>{expenseCategoryGroups.map(group=><optgroup label={group.label} key={group.label}>{group.items.map(item=><option key={item}>{item}</option>)}</optgroup>)}</select></label><label>Descrição<input autoFocus placeholder={category==='Outros'?'Ex.: manutenção da cadeira':'Ex.: conta de energia deste mês'} value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="form-two"><label>Valor (R$)<input type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Data de início<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><label className="recurring-option"><input type="checkbox" checked={fixedMonthly} onChange={e=>setFixedMonthly(e.target.checked)}/><span className="fake-check"><Check size={12}/></span><span><b>Despesa fixa mensal</b><small>Inclui este valor nos meses seguintes até remover o lançamento.</small></span></label>{error&&<p className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="button button-soft" onClick={onClose}>Cancelar</button><button className="button button-primary"><Check size={15}/> Salvar despesa</button></div></form></ModalShell>;
}

function SettingsModal({ data, update, onClose }) { return <ModalShell title="Personalizar visual" subtitle="Ajuste a aparência do seu espaço de gestão." onClose={onClose}><div className="settings-content"><div className="setting-row"><div><b>Tema da interface</b><small>Escolha entre claro e escuro.</small></div><div className="theme-selector" role="group" aria-label="Tema da interface"><button type="button" className={!data.dark?'active':''} aria-pressed={!data.dark} onClick={()=>update('dark',false)}><Sun size={15}/>Claro</button><button type="button" className={data.dark?'active':''} aria-pressed={data.dark} onClick={()=>update('dark',true)}><Moon size={15}/>Escuro</button></div></div><div className="setting-section"><b>Cor de destaque</b><small>Usada nos botões e detalhes da interface.</small><div className="color-picker">{PALETTE.map(c=><button type="button" key={c} style={{background:c}} className={data.accent===c?'selected':''} onClick={()=>update('accent',c)} aria-label={`Cor ${c}`}>{data.accent===c&&<Check size={14}/>}</button>)}</div></div><button className="button button-primary full-button" onClick={onClose}>Concluir</button></div></ModalShell>; }
function ModalShell({title,subtitle,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="app-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">BRAVIO STUDIO</p><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" aria-label="Fechar" onClick={onClose}><X size={19}/></button></div>{children}</section></div>; }

createRoot(document.getElementById('root')).render(<App />);
