'use client';

import { useMemo } from 'react';
import type { ChildAccount, ParentClient, Todo, AppUser } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Clock, 
  TrendingUp, 
  PieChart, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManagementDashboardProps {
  accounts: ChildAccount[];
  clients: ParentClient[];
  todos: Todo[];
  teamMembers: AppUser[];
}

export default function ManagementDashboard({
  accounts,
  clients,
  todos,
  teamMembers,
}: ManagementDashboardProps) {
  // 1. Calculations
  const stats = useMemo(() => {
    const activeAccounts = accounts.filter(a => !a.isPaused);
    const totalMRR = activeAccounts.reduce((acc, curr) => acc + (curr.managementFee?.amount || 0), 0);
    const avgMRR = activeAccounts.length > 0 ? totalMRR / activeAccounts.length : 0;

    // Segmentation by Parent Client (Agency)
    const agencySegmentation = clients.map(client => {
      const clientAccounts = activeAccounts.filter(a => a.parentClientId === client.id);
      const mrr = clientAccounts.reduce((acc, curr) => acc + (curr.managementFee?.amount || 0), 0);
      
      // Calculate total worked hours for this agency's todos
      const agencyTodos = todos.filter(t => t.parentClientId === client.id);
      const totalHours = agencyTodos.reduce((acc, curr) => acc + (curr.workedHours || 0), 0);

      return {
        id: client.id,
        name: client.clientName,
        logo: client.logoUrl,
        type: client.clientType,
        accountsCount: clientAccounts.length,
        mrr,
        hours: totalHours,
      };
    }).sort((a, b) => b.mrr - a.mrr);

    // Employee workload & hours
    const employeeWorkload = teamMembers.map(employee => {
      const employeeTodos = todos.filter(t => t.assigneeId === employee.uid);
      const openCount = employeeTodos.filter(t => !t.completed).length;
      const completedCount = employeeTodos.filter(t => t.completed).length;
      const totalHours = employeeTodos.reduce((acc, curr) => acc + (curr.workedHours || 0), 0);

      return {
        uid: employee.uid,
        name: employee.displayName || employee.email,
        openCount,
        completedCount,
        hours: totalHours,
      };
    }).filter(e => e.openCount > 0 || e.completedCount > 0 || e.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    return {
      activeAccountsCount: activeAccounts.length,
      pausedAccountsCount: accounts.length - activeAccounts.length,
      totalMRR,
      avgMRR,
      agencySegmentation,
      employeeWorkload,
    };
  }, [accounts, clients, todos, teamMembers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <Card className="bg-[#0F172A]/40 border-border relative overflow-hidden">
          <div className="absolute right-4 top-4 text-emerald-500/10"><DollarSign className="size-16" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider">Total MRR</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-100 font-headline mt-1">
              €{stats.totalMRR.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 font-medium">Berekend over actieve pakketten</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0F172A]/40 border-border relative overflow-hidden">
          <div className="absolute right-4 top-4 text-blue-500/10"><Briefcase className="size-16" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider">Actieve Accounts</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-100 font-headline mt-1">
              {stats.activeAccountsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 font-medium">Gepauzeerd: {stats.pausedAccountsCount} accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0F172A]/40 border-border relative overflow-hidden">
          <div className="absolute right-4 top-4 text-purple-500/10"><TrendingUp className="size-16" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider">Gemiddelde Fee / Account</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-100 font-headline mt-1">
              €{stats.avgMRR.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 font-medium">Gemiddelde fee per actief account</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0F172A]/40 border-border relative overflow-hidden">
          <div className="absolute right-4 top-4 text-orange-500/10"><Clock className="size-16" /></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider">Totaal Geschreven Uren</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-100 font-headline mt-1">
              {todos.reduce((sum, t) => sum + (t.workedHours || 0), 0)}u
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 font-medium">Geregistreerd in open & afgeronde taken</p>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Agency / Client Segmentation */}
        <Card className="bg-card border-border flex flex-col">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-slate-200 font-semibold text-lg flex items-center gap-2">
              <PieChart className="size-5 text-primary" />
              <span>Omzetverdeling & Segmentatie</span>
            </CardTitle>
            <CardDescription className="text-xs">Omzet en uren verdeeld per Parent Client (Agency label)</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-6 space-y-6">
            {stats.agencySegmentation.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">Geen Parent Clients gevonden om te segmenteren.</div>
            ) : (
              stats.agencySegmentation.map(agency => {
                const percentage = stats.totalMRR > 0 ? (agency.mrr / stats.totalMRR) * 100 : 0;
                return (
                  <div key={agency.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-200">{agency.name}</p>
                        <p className="text-xs text-slate-500">{agency.accountsCount} active accounts • {agency.hours}u geschreven</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-100">€{agency.mrr.toLocaleString('nl-NL')}</p>
                        <p className="text-[10px] text-slate-500 font-medium font-mono">{percentage.toFixed(1)}% aandeel</p>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2 bg-slate-900" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Team Workload & Hours */}
        <Card className="bg-card border-border flex flex-col">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-slate-200 font-semibold text-lg flex items-center gap-2">
              <Users className="size-5 text-purple-400" />
              <span>Team Workload & Geschreven Uren</span>
            </CardTitle>
            <CardDescription className="text-xs">Lopende/afgeronde taken en uren per medewerker</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-6">
            {stats.employeeWorkload.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">Geen taken of uren geregistreerd voor medewerkers.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-slate-300">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase font-black tracking-wider text-slate-400">
                      <th className="pb-3">Naam</th>
                      <th className="pb-3 text-center">Open Taken</th>
                      <th className="pb-3 text-center font-bold text-green-400">Afgerond</th>
                      <th className="pb-3 text-right">Totaal Uren</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.employeeWorkload.map(emp => (
                      <tr key={emp.uid} className="border-b border-border last:border-0 hover:bg-white/[0.01] transition-colors">
                        <td className="py-3.5 text-sm font-semibold text-slate-200">{emp.name}</td>
                        <td className="py-3.5 text-center text-sm">{emp.openCount} taken</td>
                        <td className="py-3.5 text-center text-sm font-medium text-green-400 flex items-center justify-center gap-1">
                          <CheckCircle className="size-3.5 shrink-0" />
                          <span>{emp.completedCount}</span>
                        </td>
                        <td className="py-3.5 text-right font-mono font-bold text-sm text-slate-100">{emp.hours}u</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
