// Payroll tool: get_payroll
// Business rules per src/app/payroll/payroll-view.tsx + plan:
//   gross = base_salary + housing_allowance + other_allowances
//   GOSI (employee) = 9.75% of min(base + housing, 45000), only when is_saudi
//   late penalties from the month's attendance (location_required=false exempt)
//   advance deduction = first approved advance (remaining > 0) monthly_deduction
//   net = max(gross - gosi - penalties - advance, 0)
import { z } from "zod";
import {
  json,
  withError,
  throwIfError,
  resolveEmployee,
  listUsers,
  displayName,
  minutesLate,
  calcPenaltyPct,
  calcDailySalary,
  roundMoney,
  GOSI_RATE,
  GOSI_RATE_COMPANY,
  GOSI_CAP,
  ksaToday,
} from "../lib/helpers.js";

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "get_payroll",
    {
      description:
        "Compute payroll for a month: gross, GOSI, late/absence penalties, advance deductions, net. كشف الرواتب الشهري",
      inputSchema: {
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("Month as YYYY-MM (defaults to current KSA month)"),
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
      },
    },
    withError(async (args) => {
      const month = args.month || ksaToday().slice(0, 7);
      const [y, m] = month.split("-").map(Number);
      const from = `${month}-01`;
      const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of month

      const users = await listUsers(supabase);
      let targets = users;
      if (args.employee_id || args.email) {
        targets = [await resolveEmployee(supabase, args)];
      }
      const ids = targets.map((u) => u.user_id);

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id, base_salary, housing_allowance, other_allowances, is_saudi, location_required"
        )
        .in("id", ids);
      throwIfError(profErr);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const { data: attendance, error: attErr } = await supabase
        .from("attendance")
        .select("employee_id, date, check_in, status")
        .in("employee_id", ids)
        .gte("date", from)
        .lte("date", to);
      throwIfError(attErr);
      const attByEmp = new Map();
      for (const r of attendance || []) {
        if (!attByEmp.has(r.employee_id)) attByEmp.set(r.employee_id, []);
        attByEmp.get(r.employee_id).push(r);
      }

      const { data: advances, error: advErr } = await supabase
        .from("salary_advances")
        .select("employee_id, amount, monthly_deduction, remaining_balance, status")
        .in("employee_id", ids)
        .eq("status", "approved");
      throwIfError(advErr);
      const advByEmp = new Map();
      for (const a of advances || []) {
        if (a.remaining_balance > 0 && !advByEmp.has(a.employee_id)) {
          advByEmp.set(a.employee_id, a);
        }
      }

      const payroll = targets.map((u) => {
        const p = profileMap.get(u.user_id) || {};
        const basic = Number(p.base_salary) || 0;
        const housing = Number(p.housing_allowance) || 0;
        const other = Number(p.other_allowances) || 0;
        const gross = roundMoney(basic + housing + other);
        const isSaudi = p.is_saudi === true;
        const gosiBase = Math.min(basic + housing, GOSI_CAP);
        const gosi = isSaudi ? roundMoney(gosiBase * GOSI_RATE) : 0;
        const gosiCompany = isSaudi ? roundMoney(gosiBase * GOSI_RATE_COMPANY) : 0;
        const daily = calcDailySalary(gross);

        let penalties = 0;
        const penaltyDays = [];
        const exempt = p.location_required === false;
        if (!exempt) {
          for (const a of attByEmp.get(u.user_id) || []) {
            let amount = 0;
            let kind = null;
            if (a.status === "absent") {
              amount = roundMoney(daily);
              kind = "absent";
            } else if (a.check_in) {
              const late = minutesLate(a.check_in);
              const pct = calcPenaltyPct(late);
              if (pct > 0) {
                amount = roundMoney((daily * pct) / 100);
                kind = `late-${late}min-${pct}pct`;
              }
            }
            if (amount > 0) {
              penalties = roundMoney(penalties + amount);
              penaltyDays.push({ date: a.date, kind, amount });
            }
          }
        }

        const adv = advByEmp.get(u.user_id);
        const advanceDeduction = adv ? roundMoney(adv.monthly_deduction) : 0;

        const net = roundMoney(Math.max(gross - gosi - penalties - advanceDeduction, 0));
        return {
          employeeId: u.user_id,
          email: u.email,
          ...displayName(u),
          basic,
          housing,
          other,
          gross,
          isSaudi,
          gosi,
          gosiCompany,
          penalties,
          penaltyDays,
          advanceDeduction,
          advanceRemaining: adv ? adv.remaining_balance : 0,
          net,
          locationExempt: exempt,
        };
      });

      const totals = {
        gross: roundMoney(payroll.reduce((s, p) => s + p.gross, 0)),
        gosi: roundMoney(payroll.reduce((s, p) => s + p.gosi, 0)),
        gosiCompany: roundMoney(payroll.reduce((s, p) => s + p.gosiCompany, 0)),
        penalties: roundMoney(payroll.reduce((s, p) => s + p.penalties, 0)),
        advances: roundMoney(payroll.reduce((s, p) => s + p.advanceDeduction, 0)),
        net: roundMoney(payroll.reduce((s, p) => s + p.net, 0)),
      };

      return json({ month, currency: "SAR", count: payroll.length, totals, payroll });
    })
  );
}
