'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleHelp,
  CreditCard, Goal, LayoutDashboard, Menu, MoreHorizontal, Moon, Plus, Search, Settings,
  Tags, TrendingUp, Wallet, X, Zap, Receipt, SlidersHorizontal, ArrowRight, CheckCircle2,
  PieChart, Target, PlusCircle, AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Transaction = {
  id: string | number
  name: string
  category: string
  date: string
  rawDate: Date
  amount: number
  icon: string
  tone: string
  type: 'income' | 'expense'
  payment_method?: string
}

type GoalItem = {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date?: string
}

type NotificationItem = {
  id: string
  title: string
  desc: string
  time: string
  read: boolean
}

const nav = [
  ['Overview', LayoutDashboard],
  ['Transactions', CreditCard],
  ['Analytics', BarChart3],
  ['Goals', Goal],
  ['Categories', Tags],
] as const

const money = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.abs(n).toLocaleString('id-ID')}`

// Komponen Animasi Angka Berhitung
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const duration = 800
    const startValue = 0
    const endValue = value

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const current = Math.floor(progress * (endValue - startValue) + startValue)
      setDisplayValue(current)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      }
    }

    window.requestAnimationFrame(step)
  }, [value])

  return <>{money(displayValue)}</>
}

export default function Page() {
  const [active, setActive] = useState('Overview')
  const [period, setPeriod] = useState('This month')
  const [showModal, setShowModal] = useState(false)
  const [showSavingsModal, setShowSavingsModal] = useState(false)
  const [showNewGoalModal, setShowNewGoalModal] = useState(false)

  const [query, setQuery] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<GoalItem[]>([])
  const [toast, setToast] = useState('')

  // State Fitur Notifikasi
  const [notifOpen, setNotifOpen] = useState(false)
  const [readNotifIds, setReadNotifIds] = useState<string[]>([])

  // State Form Deposit Goal
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null)
  const [depositAmount, setDepositAmount] = useState('')

  // State Form New Goal
  const [newGoalName, setNewGoalName] = useState('')
  const [newGoalTarget, setNewGoalTarget] = useState('')
  const [newGoalDate, setNewGoalDate] = useState('')

  // State Dropdown Header
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('all')
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false)

  // State Custom Dropdown Tab Transactions
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [txTypeDropdownOpen, setTxTypeDropdownOpen] = useState(false)

  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('all')
  const [txCatDropdownOpen, setTxCatDropdownOpen] = useState(false)

  // State Filter Kategori Doughnut Chart
  const [chartCategoryFilter, setChartCategoryFilter] = useState<string>('all')
  const [chartFilterOpen, setChartFilterOpen] = useState(false)

  // State Trigger Animasi Bar & Doughnut
  const [chartAnimProgress, setChartAnimProgress] = useState(0)

  // Form Modal State Add Transaction
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Others')
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  // Limit Baku Kategori
  const categoryLimits: Record<string, number> = useMemo(() => ({
    'Food & Dining': 1500000,
    'Transport': 500000,
    'Shopping': 1000000,
    'Groceries': 1200000,
    'Others': 800000,
  }), [])

  // Fetch Data Supabase
  const fetchData = async () => {
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })

    if (txData) {
      const formatted: Transaction[] = txData.map((t: any) => {
        const isExpense = t.type === 'expense'
        const val = Number(t.amount) || 0
        const dateObj = t.created_at ? new Date(t.created_at) : new Date()
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

        return {
          id: t.id,
          name: t.description || 'Tanpa Keterangan',
          category: t.category || 'Others',
          date: dateStr,
          rawDate: dateObj,
          amount: isExpense ? -val : val,
          icon: (t.description || 'TX').slice(0, 2).toUpperCase(),
          tone: isExpense ? 'coral' : 'mint',
          type: t.type === 'income' ? 'income' : 'expense',
          payment_method: t.payment_method || 'Cash',
        }
      })
      setTransactions(formatted)
    }

    const { data: goalData } = await supabase
      .from('goals')
      .select('*')
      .order('id', { ascending: true })

    if (goalData) {
      setGoals(goalData)
      if (goalData.length > 0 && !selectedGoalId) {
        setSelectedGoalId(goalData[0].id)
      }
    }
  }

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('realtime-nextjs-ledgerly-v11')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Trigger Animasi Chart
  useEffect(() => {
    if (active === 'Overview') {
      setChartAnimProgress(0)
      const timeout = setTimeout(() => {
        setChartAnimProgress(1)
      }, 150)
      return () => clearTimeout(timeout)
    }
  }, [active, transactions, chartCategoryFilter])

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>()
    transactions.forEach((t) => {
      if (t.rawDate) {
        const yyyy = t.rawDate.getFullYear()
        const mm = String(t.rawDate.getMonth() + 1).padStart(2, '0')
        monthsSet.add(`${yyyy}-${mm}`)
      }
    })
    return Array.from(monthsSet).sort().reverse()
  }, [transactions])

  const currentMonthLabel = useMemo(() => {
    if (selectedMonthYear === 'all') return 'All Months'
    const [yyyy, mm] = selectedMonthYear.split('-')
    const date = new Date(Number(yyyy), Number(mm) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }, [selectedMonthYear])

  const income = useMemo(() => transactions.filter((t) => t.type === 'income').reduce((a, t) => a + Math.abs(t.amount), 0), [transactions])
  const expenses = useMemo(() => transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + Math.abs(t.amount), 0), [transactions])
  const totalBalance = income - expenses
  const currentDayOfMonth = new Date().getDate()
  const avgDailySpent = expenses > 0 ? expenses / currentDayOfMonth : 0

  const overviewFiltered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = `${t.name} ${t.category} ${t.payment_method || ''}`.toLowerCase().includes(query.toLowerCase())
      let matchesMonth = true
      if (selectedMonthYear !== 'all' && t.rawDate) {
        const yyyy = t.rawDate.getFullYear()
        const mm = String(t.rawDate.getMonth() + 1).padStart(2, '0')
        matchesMonth = `${yyyy}-${mm}` === selectedMonthYear
      }
      return matchesSearch && matchesMonth
    })
  }, [transactions, query, selectedMonthYear])

  const fullTxFiltered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = `${t.name} ${t.category} ${t.payment_method || ''}`.toLowerCase().includes(query.toLowerCase())
      const matchesType = txTypeFilter === 'all' || t.type === txTypeFilter
      const matchesCategory = txCategoryFilter === 'all' || t.category === txCategoryFilter
      let matchesMonth = true
      if (selectedMonthYear !== 'all' && t.rawDate) {
        const yyyy = t.rawDate.getFullYear()
        const mm = String(t.rawDate.getMonth() + 1).padStart(2, '0')
        matchesMonth = `${yyyy}-${mm}` === selectedMonthYear
      }
      return matchesSearch && matchesType && matchesCategory && matchesMonth
    })
  }, [transactions, query, txTypeFilter, txCategoryFilter, selectedMonthYear])

  const categoryAnalytics = useMemo(() => {
    const expenseTx = transactions.filter((t) => t.type === 'expense')
    const categoryTotals: Record<string, number> = {}
    expenseTx.forEach((t) => {
      const cat = t.category || 'Others'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.amount)
    })
    return Object.entries(categoryTotals)
      .map(([cat, total]) => ({
        name: cat,
        total,
        percentage: expenses > 0 ? Math.round((total / expenses) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [transactions, expenses])

  // Generator Notifikasi Otomatis Berdasarkan Real-Data Supabase
  const dynamicNotifications = useMemo<NotificationItem[]>(() => {
    const notifs: NotificationItem[] = []

    // 1. Cek Warning Limit Budget Kategori Real-Time
    categoryAnalytics.forEach((c) => {
      const limit = categoryLimits[c.name] || 1000000
      const spentPct = Math.round((c.total / limit) * 100)

      if (spentPct >= 75) {
        notifs.push({
          id: `limit-${c.name}`,
          title: `${c.name} Limit Warning`,
          desc: `Category ${c.name} is near limit (${spentPct}% spent of ${money(limit)})`,
          time: 'Just now',
          read: readNotifIds.includes(`limit-${c.name}`),
        })
      }
    })

    // 2. Info Transaksi Terakhir
    if (transactions.length > 0) {
      const latestTx = transactions[0]
      notifs.push({
        id: `tx-${latestTx.id}`,
        title: `Latest Transaction Synced`,
        desc: `${latestTx.name} (${money(latestTx.amount)}) recorded via ${latestTx.payment_method}`,
        time: latestTx.date,
        read: readNotifIds.includes(`tx-${latestTx.id}`),
      })
    }

    // 3. Info Status Database
    notifs.push({
      id: 'sys-sync',
      title: 'System Sync Active',
      desc: 'Supabase & n8n real-time database connected smoothly',
      time: 'Today',
      read: readNotifIds.includes('sys-sync'),
    })

    return notifs
  }, [categoryAnalytics, categoryLimits, transactions, readNotifIds])

  const unreadNotifCount = useMemo(() => dynamicNotifications.filter(n => !n.read).length, [dynamicNotifications])

  const filteredCategoryAnalytics = useMemo(() => {
    if (chartCategoryFilter === 'all') return categoryAnalytics
    return categoryAnalytics.filter((c) => c.name === chartCategoryFilter)
  }, [categoryAnalytics, chartCategoryFilter])

  const chartFilteredTotalSpent = useMemo(() => {
    return filteredCategoryAnalytics.reduce((acc, curr) => acc + curr.total, 0)
  }, [filteredCategoryAnalytics])

  const doughnutStyle = useMemo(() => {
    if (!expenses || filteredCategoryAnalytics.length === 0) {
      return { background: 'var(--muted)' }
    }

    const colors = ['var(--primary)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--accent)']
    let currentPct = 0

    const stops = filteredCategoryAnalytics.map((item, index) => {
      const color = colors[index % colors.length]
      const startPct = currentPct
      const actualPct = chartCategoryFilter === 'all' 
        ? item.percentage 
        : Math.round((item.total / chartFilteredTotalSpent) * 100)
      
      const targetSegmentPct = actualPct * chartAnimProgress
      currentPct += targetSegmentPct
      return `${color} ${startPct}% ${currentPct}%`
    })

    if (currentPct < 100) {
      stops.push(`var(--muted) ${currentPct}% 100%`)
    }

    return { 
      background: `conic-gradient(${stops.join(', ')})`,
      transition: 'background 1s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s ease'
    }
  }, [filteredCategoryAnalytics, expenses, chartCategoryFilter, chartFilteredTotalSpent, chartAnimProgress])

  function markAllNotifRead() {
    const allIds = dynamicNotifications.map(n => n.id)
    setReadNotifIds(allIds)
  }

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  async function handleAddSavings() {
    const val = Number(depositAmount)
    if (!val || val <= 0 || !selectedGoalId) return

    const targetGoal = goals.find((g) => g.id === selectedGoalId)
    if (!targetGoal) return

    const newCurrent = Number(targetGoal.current_amount || 0) + val

    const { error } = await supabase
      .from('goals')
      .update({ current_amount: newCurrent })
      .eq('id', selectedGoalId)

    if (error) {
      notify('Gagal menambah tabungan')
      return
    }

    setDepositAmount('')
    setShowSavingsModal(false)
    notify(`Saved ${money(val)} to ${targetGoal.name}! 🎉`)
  }

  async function handleCreateNewGoal() {
    const targetVal = Number(newGoalTarget)
    if (!newGoalName.trim() || !targetVal || targetVal <= 0) return

    const { error } = await supabase.from('goals').insert([
      {
        name: newGoalName,
        target_amount: targetVal,
        current_amount: 0,
        target_date: newGoalDate || 'Ongoing',
      },
    ])

    if (error) {
      notify('Gagal membuat goal baru')
      return
    }

    setNewGoalName('')
    setNewGoalTarget('')
    setNewGoalDate('')
    setShowNewGoalModal(false)
    notify(`New Goal "${newGoalName}" created! 🚀`)
  }

  async function addTransaction() {
    const value = Number(amount)
    if (!description.trim() || !value || value <= 0) return

    const { error } = await supabase.from('transactions').insert([
      {
        description,
        amount: value,
        type,
        category,
        payment_method: paymentMethod,
      },
    ])

    if (error) {
      notify('Gagal menambahkan transaksi')
      return
    }

    setDescription('')
    setAmount('')
    setShowModal(false)
    notify('Transaction added successfully')
  }

  const activeGoal = goals.find((g) => g.id === selectedGoalId) || goals[0]
  const activeGoalPercent = activeGoal ? Math.min(100, Math.round(((activeGoal.current_amount || 0) / activeGoal.target_amount) * 100)) : 0

  return (
    <div className={darkMode ? 'dark min-h-screen' : 'min-h-screen'}>
      <div className="flex min-h-screen bg-background text-foreground">
        
        {/* Sidebar Navigasi Fixed */}
        <aside className={`${mobileOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-72 flex-col border-r border-border bg-card px-5 py-6 shadow-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shadow-none overflow-y-auto shrink-0`}>
          <div className="flex items-center justify-between px-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Wallet size={18} />
              </div>
              <span className="text-lg font-semibold tracking-tight">Ledgerly</span>
            </div>
            <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
          </div>
          
          <div className="mt-8 flex flex-col gap-1 shrink-0">
            {nav.map(([label, Icon]) => (
              <button key={label} onClick={() => { setActive(label); setMobileOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active === label ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <Icon size={17} />
                {label}
                {label === 'Goals' && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">{goals.length}</span>}
              </button>
            ))}
          </div>

          {goals.length > 0 && (
            <div 
              onClick={() => {
                setSelectedGoalId(goals[0].id)
                setShowSavingsModal(true)
              }}
              className="mt-6 cursor-pointer rounded-2xl bg-secondary p-4 transition-transform hover:scale-[1.02] shrink-0"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">Savings goal</p>
                <Goal size={16} className="text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium">{goals[0].name}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round(((goals[0].current_amount || 0) / goals[0].target_amount) * 100))}%` }} 
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{money(goals[0].current_amount || 0)} saved</span>
                <span>{money(goals[0].target_amount)}</span>
              </div>
            </div>
          )}

          <div className="mt-auto pt-6 flex flex-col gap-1 shrink-0">
            <button className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <Settings size={17} />Settings
            </button>
            <button className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <CircleHelp size={17} />Help center
            </button>
            <div className="mt-3 flex items-center gap-3 border-t border-border pt-4">
              <div className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">GS</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Gregory</p>
                <p className="truncate text-xs text-muted-foreground">Personal account</p>
              </div>
              <MoreHorizontal className="ml-auto text-muted-foreground" size={17} />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-border bg-card/90 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sunday, August 30, 2026</p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">Good morning, Gregory</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted md:flex">
                <Search size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="bg-transparent text-sm outline-none w-28" />
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Toggle theme">
                <Moon size={18} />
              </button>
              
              {/* Tombol & Popover Notifikasi Fixed Z-Index [60] */}
              <div className="relative z-[60]">
                <button 
                  onClick={() => {
                    setNotifOpen(!notifOpen)
                    setPeriodDropdownOpen(false)
                    setMonthDropdownOpen(false)
                  }} 
                  className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" 
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadNotifCount > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive animate-ping" />}
                  {unreadNotifCount > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-3 z-[60] w-80 rounded-2xl border border-border bg-card p-4 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">Notifications</h4>
                        {unreadNotifCount > 0 && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {unreadNotifCount} new
                          </span>
                        )}
                      </div>
                      <button onClick={markAllNotifRead} className="text-xs text-primary font-medium hover:underline">
                        Mark read
                      </button>
                    </div>

                    <div className="divide-y divide-border max-h-64 overflow-y-auto">
                      {dynamicNotifications.map((n) => (
                        <div key={n.id} className={`py-2.5 px-2 rounded-xl space-y-1 transition-colors ${!n.read ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold flex items-center gap-1.5">
                              {!n.read && <i className="size-1.5 rounded-full bg-primary inline-block" />}
                              {n.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{n.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{n.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowModal(true)} className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 sm:flex">
                <Plus size={17} />Add transaction
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-9">
            
            {/* Header Title & Dropdowns */}
            <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm text-muted-foreground">Your financial snapshot</p>
                <div className="mt-1 flex items-center gap-3">
                  <h2 className="text-3xl font-semibold tracking-tight">{active}</h2>
                  <span className="rounded-full bg-chart-2/15 px-2.5 py-1 text-xs font-medium text-chart-2">Healthy</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative z-30">
                  <button
                    onClick={() => {
                      setPeriodDropdownOpen(!periodDropdownOpen)
                      setMonthDropdownOpen(false)
                      setNotifOpen(false)
                    }}
                    className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {period}
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${periodDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {periodDropdownOpen && (
                    <div className="absolute left-0 mt-2 z-30 w-36 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                      {['This month', 'Last month', 'This year'].map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            setPeriod(option)
                            setPeriodDropdownOpen(false)
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                            period === option
                              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative z-30">
                  <button
                    onClick={() => {
                      setMonthDropdownOpen(!monthDropdownOpen)
                      setPeriodDropdownOpen(false)
                      setNotifOpen(false)
                    }}
                    className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <CalendarDays size={15} />
                    {currentMonthLabel}
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${monthDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {monthDropdownOpen && (
                    <div className="absolute right-0 mt-2 z-30 w-44 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                      <button
                        onClick={() => {
                          setSelectedMonthYear('all')
                          setMonthDropdownOpen(false)
                        }}
                        className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                          selectedMonthYear === 'all'
                            ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        All Months
                      </button>

                      {availableMonths.map((m) => {
                        const [yyyy, mm] = m.split('-')
                        const label = new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                        return (
                          <button
                            key={m}
                            onClick={() => {
                              setSelectedMonthYear(m)
                              setMonthDropdownOpen(false)
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                              selectedMonthYear === m
                                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ==================== TAB 1: OVERVIEW ==================== */}
            {active === 'Overview' && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total balance" animatedValue={totalBalance} change="+8.2%" icon={<Wallet size={17} />} />
                  <StatCard label="Income" animatedValue={income} change="+12.4%" icon={<ArrowDownLeft size={17} />} />
                  <StatCard label="Expenses" animatedValue={expenses} change="-3.1%" icon={<ArrowUpRight size={17} />} negative />
                  <StatCard label="Savings rate" value={`${activeGoalPercent}%`} change="+5.8%" icon={<TrendingUp size={17} />} />
                </section>

                <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
                  
                  {/* Cash Flow Bar Chart */}
                  <Card title="Cash flow" subtitle="Income vs. expenses over time" action={<MoreHorizontal size={18} />}>
                    <div className="mt-7 flex h-56 items-end gap-3 md:gap-6">
                      {[48, 62, 45, 76, 66, 88].map((height, i) => {
                        const targetHeight = chartAnimProgress * height
                        const targetExpHeight = chartAnimProgress * (height * 0.48)
                        return (
                          <div key={i} className="flex flex-1 flex-col items-center gap-3">
                            <div className="flex h-44 w-full items-end justify-center gap-1.5">
                              <div 
                                style={{ 
                                  height: `${targetHeight}%`,
                                  transitionDelay: `${i * 80}ms`
                                }} 
                                className="w-1/2 rounded-t-md bg-primary/90 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-primary shadow-sm" 
                              />
                              <div 
                                style={{ 
                                  height: `${targetExpHeight}%`,
                                  transitionDelay: `${i * 80 + 40}ms`
                                }} 
                                className="w-1/2 rounded-t-md bg-chart-2/80 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-chart-2 shadow-sm" 
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][i]}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-5 flex items-center gap-5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-primary" />Income</span>
                      <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-chart-2" />Expenses</span>
                      <span className="ml-auto font-medium text-foreground">Net +{money(totalBalance)}</span>
                    </div>
                  </Card>

                  {/* Doughnut Chart Komponen */}
                  <Card 
                    title="Spending by category" 
                    subtitle={chartCategoryFilter === 'all' ? 'Top categories overview' : `Filtered: ${chartCategoryFilter}`} 
                    action={
                      <div className="relative z-20">
                        <button 
                          onClick={() => setChartFilterOpen(!chartFilterOpen)}
                          className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-xs font-medium transition-colors ${
                            chartCategoryFilter !== 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                          title="Filter Chart Categories"
                        >
                          <SlidersHorizontal size={15} />
                        </button>

                        {chartFilterOpen && (
                          <div className="absolute right-0 mt-2 z-30 w-44 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                            <p className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Filter Category</p>
                            <button
                              onClick={() => {
                                setChartCategoryFilter('all')
                                setChartFilterOpen(false)
                              }}
                              className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                                chartCategoryFilter === 'all'
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              All Categories
                            </button>
                            {categoryAnalytics.map((cat) => (
                              <button
                                key={cat.name}
                                onClick={() => {
                                  setChartCategoryFilter(cat.name)
                                  setChartFilterOpen(false)
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                                  chartCategoryFilter === cat.name
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                  >
                    <div className="mt-6 flex items-center gap-6">
                      <div 
                        className={`relative flex size-36 shrink-0 items-center justify-center rounded-full shadow-md transition-transform duration-700 ease-out ${
                          chartAnimProgress === 1 ? 'scale-100' : 'scale-90'
                        }`}
                        style={doughnutStyle}
                      >
                        <div className="flex size-20 flex-col items-center justify-center rounded-full bg-card shadow-inner transition-transform duration-300 hover:scale-105">
                          <span className="text-xs font-semibold text-center px-1">
                            <AnimatedNumber value={chartFilteredTotalSpent} />
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {chartCategoryFilter === 'all' ? 'total spent' : chartCategoryFilter}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-3">
                        {filteredCategoryAnalytics.slice(0, 4).map((cat, idx) => {
                          const dotColors = ['bg-primary', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4']
                          const originalIndex = categoryAnalytics.findIndex(c => c.name === cat.name)
                          const displayPct = chartCategoryFilter === 'all' ? cat.percentage : 100

                          return (
                            <div key={cat.name} className="flex items-center gap-2 text-xs transition-all duration-300">
                              <i className={`size-2 rounded-full ${dotColors[originalIndex % dotColors.length]}`} />
                              <span className="flex-1 text-muted-foreground truncate">{cat.name}</span>
                              <span className="font-semibold text-foreground">{displayPct}%</span>
                            </div>
                          )
                        })}
                        {filteredCategoryAnalytics.length === 0 && <p className="text-xs text-muted-foreground">No category data.</p>}
                      </div>
                    </div>
                  </Card>
                </section>

                <section className="mt-5 grid gap-5 lg:grid-cols-3">
                  <MiniCard icon={<Zap size={17} />} title="Spending health" value="84 / 100" text="You're spending 12% less than last month." />
                  
                  {goals.length > 0 && (
                    <div onClick={() => { setSelectedGoalId(goals[0].id); setShowSavingsModal(true); }} className="cursor-pointer transition-transform hover:scale-[1.01]">
                      <MiniCard 
                        icon={<Goal size={17} />} 
                        title="Savings goals" 
                        animatedValue={goals[0].current_amount || 0} 
                        text={`${Math.min(100, Math.round(((goals[0].current_amount || 0) / goals[0].target_amount) * 100))}% of ${goals[0].name} is complete.`} 
                        progress={`${Math.min(100, Math.round(((goals[0].current_amount || 0) / goals[0].target_amount) * 100))}%`} 
                      />
                    </div>
                  )}

                  <MiniCard icon={<Receipt size={17} />} title="Upcoming bills" animatedValue={248000} text="3 recurring payments due this week." />
                </section>

                <section className="mt-5 rounded-2xl border border-border bg-card">
                  <div className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
                    <div>
                      <h3 className="font-semibold">Recent transactions</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{overviewFiltered.length} activity items in your account</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActive('Transactions')} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                        View all <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {overviewFiltered.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 md:px-6">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${t.tone === 'coral' ? 'bg-destructive/10 text-destructive' : 'bg-chart-2/15 text-chart-2'}`}>
                          {t.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t.category} · {t.payment_method} · {t.date}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold ${t.amount > 0 ? 'text-chart-2' : ''}`}>
                          {t.amount > 0 ? '+' : ''}{money(t.amount)}
                        </p>
                      </div>
                    ))}
                    {!overviewFiltered.length && <p className="px-6 py-10 text-center text-sm text-muted-foreground">No transactions found in Supabase.</p>}
                  </div>
                </section>
              </>
            )}

            {/* ==================== TAB 2: TRANSACTIONS ==================== */}
            {active === 'Transactions' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">All Transactions History</h3>
                      <p className="text-sm text-muted-foreground">Showing {fullTxFiltered.length} transactions recorded in Supabase</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() => {
                            setTxTypeDropdownOpen(!txTypeDropdownOpen)
                            setTxCatDropdownOpen(false)
                          }}
                          className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted transition-colors"
                        >
                          {txTypeFilter === 'all' ? 'All Types' : txTypeFilter === 'income' ? '🟢 Income Only' : '🔴 Expense Only'}
                          <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${txTypeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {txTypeDropdownOpen && (
                          <div className="absolute right-0 mt-2 z-50 w-44 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                            {[
                              { label: 'All Types', val: 'all' },
                              { label: '🟢 Income Only', val: 'income' },
                              { label: '🔴 Expense Only', val: 'expense' },
                            ].map((opt) => (
                              <button
                                key={opt.val}
                                onClick={() => {
                                  setTxTypeFilter(opt.val as any)
                                  setTxTypeDropdownOpen(false)
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                                  txTypeFilter === opt.val
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          onClick={() => {
                            setTxCatDropdownOpen(!txCatDropdownOpen)
                            setTxTypeDropdownOpen(false)
                          }}
                          className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted transition-colors"
                        >
                          {txCategoryFilter === 'all' ? 'All Categories' : txCategoryFilter}
                          <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${txCatDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {txCatDropdownOpen && (
                          <div className="absolute right-0 mt-2 z-50 w-44 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                            {['all', 'Groceries', 'Transport', 'Shopping', 'Food & Dining', 'Gift', 'Others'].map((cat) => (
                              <button
                                key={cat}
                                onClick={() => {
                                  setTxCategoryFilter(cat)
                                  setTxCatDropdownOpen(false)
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                                  txCategoryFilter === cat
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                              >
                                {cat === 'all' ? 'All Categories' : cat}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="divide-y divide-border">
                    {fullTxFiltered.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 md:px-6">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${t.tone === 'coral' ? 'bg-destructive/10 text-destructive' : 'bg-chart-2/15 text-chart-2'}`}>
                          {t.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t.category} · {t.payment_method} · {t.date}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold ${t.amount > 0 ? 'text-chart-2' : ''}`}>
                          {t.amount > 0 ? '+' : ''}{money(t.amount)}
                        </p>
                      </div>
                    ))}
                    {!fullTxFiltered.length && <p className="px-6 py-12 text-center text-sm text-muted-foreground">No matching transactions found.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 3: ANALYTICS ==================== */}
            {active === 'Analytics' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="Avg. Daily Spent" animatedValue={avgDailySpent} change={`Based on ${currentDayOfMonth} days this month`} icon={<PieChart size={17} />} />
                  <StatCard label="Top Category" value={categoryAnalytics[0]?.name || '-'} change={`${categoryAnalytics[0]?.percentage || 0}% of spent`} icon={<Zap size={17} />} />
                  <StatCard label="Total Transactions" value={`${transactions.length} items`} change="Synced" icon={<Receipt size={17} />} />
                </div>

                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-semibold text-lg mb-1">Expense Breakdown by Category</h3>
                  <p className="text-sm text-muted-foreground mb-6">Visual breakdown calculated from your real transactions</p>

                  <div className="space-y-4">
                    {categoryAnalytics.map((item) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground"><AnimatedNumber value={item.total} /> ({item.percentage}%)</span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${item.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                    {!categoryAnalytics.length && <p className="text-sm text-muted-foreground">No expense data to analyze yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 4: GOALS ==================== */}
            {active === 'Goals' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">Savings Goals</h3>
                    <p className="text-sm text-muted-foreground">Track your progress toward financial targets ({goals.length} active goals)</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowNewGoalModal(true)} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
                      <PlusCircle size={16} /> New Goal Target
                    </button>
                    <button onClick={() => setShowSavingsModal(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                      <PlusCircle size={16} /> Deposit Money
                    </button>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {goals.map((g) => {
                    const percent = Math.min(100, Math.round(((g.current_amount || 0) / g.target_amount) * 100))
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          setSelectedGoalId(g.id)
                          setShowSavingsModal(true)
                        }}
                        className="cursor-pointer rounded-2xl border border-border bg-card p-6 space-y-4 transition-transform hover:scale-[1.01]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Target size={20} />
                            </div>
                            <div>
                              <h4 className="font-semibold">{g.name}</h4>
                              <p className="text-xs text-muted-foreground">Target Date: {g.target_date || 'Ongoing'}</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{percent}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span>Saved: <AnimatedNumber value={g.current_amount || 0} /></span>
                          <span className="text-muted-foreground">Target: {money(g.target_amount)}</span>
                        </div>
                      </div>
                    )
                  })}
                  {!goals.length && <p className="text-sm text-muted-foreground col-span-2 py-8 text-center">No savings goals created yet.</p>}
                </div>
              </div>
            )}

            {/* ==================== TAB 5: CATEGORIES ==================== */}
            {active === 'Categories' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-bold">Category Limits & Budgets</h3>
                  <p className="text-sm text-muted-foreground">Manage monthly spending limits per category</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { name: 'Food & Dining', limit: 1500000, borderClass: 'border-l-primary' },
                    { name: 'Transport', limit: 500000, borderClass: 'border-l-chart-2' },
                    { name: 'Shopping', limit: 1000000, borderClass: 'border-l-chart-3' },
                    { name: 'Groceries', limit: 1200000, borderClass: 'border-l-chart-4' },
                    { name: 'Others', limit: 800000, borderClass: 'border-l-muted-foreground' },
                  ].map((cat) => {
                    const spent = categoryAnalytics.find((c) => c.name === cat.name)?.total || 0
                    const percentage = Math.round((spent / cat.limit) * 100)

                    let statusLabel = 'Safe'
                    let statusBg = 'bg-chart-2/15 text-chart-2'

                    if (percentage >= 100) {
                      statusLabel = 'Exceeded'
                      statusBg = 'bg-destructive/15 text-destructive'
                    } else if (percentage >= 75) {
                      statusLabel = 'Warning'
                      statusBg = 'bg-chart-3/20 text-chart-3'
                    }

                    return (
                      <div key={cat.name} className={`rounded-2xl border border-border bg-card p-5 border-l-4 ${cat.borderClass} space-y-3 transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold">{cat.name}</h4>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusBg}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spent: <AnimatedNumber value={spent} /></span>
                          <span className="font-medium">Limit: {money(cat.limit)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Floating Plus Button */}
      <button onClick={() => setShowModal(true)} className="fixed bottom-5 right-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg sm:hidden" aria-label="Add transaction">
        <Plus size={22} />
      </button>

      {/* MODAL TRANSAKSI */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/30 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Add transaction</h2>
                <p className="mt-1 text-sm text-muted-foreground">Directly syncs to Supabase Database.</p>
              </div>
              <button onClick={() => setShowModal(false)} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                <button onClick={() => setType('expense')} className={`rounded-lg py-2 text-sm font-medium ${type === 'expense' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                  Expense
                </button>
                <button onClick={() => setType('income')} className={`rounded-lg py-2 text-sm font-medium ${type === 'income' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                  Income
                </button>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Coffee shop" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Amount
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="0.00" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Category
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring">
                    <option>Groceries</option>
                    <option>Transport</option>
                    <option>Shopping</option>
                    <option>Food & Dining</option>
                    <option>Gift</option>
                    <option>Others</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Payment Method
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring">
                  <option>Cash</option>
                  <option>QRIS</option>
                  <option>Bank Transfer</option>
                  <option>Credit Card</option>
                </select>
              </label>

              <button onClick={addTransaction} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground">
                <Check size={16} />Save transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEPOSIT */}
      {showSavingsModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/30 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Deposit to Savings Goal</h2>
                <p className="mt-1 text-sm text-muted-foreground">Select target and add your savings.</p>
              </div>
              <button onClick={() => setShowSavingsModal(false)} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Select Goal Target
                <select
                  value={selectedGoalId || ''}
                  onChange={(e) => setSelectedGoalId(Number(e.target.value))}
                  className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({money(g.target_amount)})
                    </option>
                  ))}
                </select>
              </label>

              {activeGoal && (
                <div className="rounded-xl bg-muted p-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Current Saved ({activeGoal.name})</span>
                    <span className="font-semibold text-foreground">{money(activeGoal.current_amount || 0)}</span>
                  </div>
                  <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${activeGoalPercent}%` }} />
                  </div>
                </div>
              )}

              <label className="flex flex-col gap-2 text-sm font-medium">
                Deposit Amount (Rp)
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. 500000"
                />
              </label>

              <button onClick={handleAddSavings} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground">
                <Check size={16} />Deposit Money
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NEW GOAL */}
      {showNewGoalModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/30 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create New Goal Target</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add a new savings target to track.</p>
              </div>
              <button onClick={() => setShowNewGoalModal(false)} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Goal Name
                <input
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. New Laptop Fund"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Target Amount (Rp)
                  <input
                    type="number"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    placeholder="15000000"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Target Date (Optional)
                  <input
                    value={newGoalDate}
                    onChange={(e) => setNewGoalDate(e.target.value)}
                    className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Dec 2026"
                  />
                </label>
              </div>

              <button onClick={handleCreateNewGoal} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground">
                <Check size={16} />Create Target Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          <CheckCircle2 size={16} className="text-chart-2" />
          {toast}
        </div>
      )}
    </div>
  )
}

function Card({ title, subtitle, action, children }: { title: string; subtitle: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div>{action}</div>
      </div>
      {children}
    </div>
  )
}

function StatCard({ label, value, animatedValue, change, icon, negative = false }: { label: string; value?: string; animatedValue?: number; change: string; icon: React.ReactNode; negative?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {animatedValue !== undefined ? <AnimatedNumber value={animatedValue} /> : value}
      </p>
      <p className={`mt-2 text-xs font-medium ${negative ? 'text-chart-2' : 'text-chart-2'}`}>
        {change} <span className="font-normal text-muted-foreground">from last month</span>
      </p>
    </div>
  )
}

function MiniCard({ icon, title, value, animatedValue, text, progress }: { icon: React.ReactNode; title: string; value?: string; animatedValue?: number; text: string; progress?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary">
        <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">{icon}</span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {animatedValue !== undefined ? <AnimatedNumber value={animatedValue} /> : value}
      </p>
      {progress && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: progress }} />
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  )
}