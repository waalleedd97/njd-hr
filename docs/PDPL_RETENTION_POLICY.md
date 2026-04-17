# سياسة الاحتفاظ بالبيانات — NJD HR

> **PDPL Retention Schedule — Employee Data**
> نظام حماية البيانات الشخصية السعودي (المرسوم الملكي م/19 لعام 1443هـ)
> آخر مراجعة: 2026-04-17

---

## 1. الإطار العام

عند استقبال طلب حذف بيانات موظف عبر `POST /api/erasure-request`
(يُسجَّل في `employee_requests.type_key = 'dataErasure'`)، تُراجعه الموارد
البشرية **خلال 30 يوماً** وفق المادة 18 من نظام PDPL.

**الحذف الكامل ممنوع بسبب التزامات تنظيمية**. يُطبَّق حذف جزئي وفق
الجدول أدناه، ويُوثَّق ما يُحتفظ به في حقل
`employee_requests.details_en`/`details_ar` عند الاعتماد
(`reviewed_by` + `reviewed_at`).

---

## 2. جدول الاحتفاظ

| الفئة | الحقول | مدة الاحتفاظ | المرجع القانوني | قابل للحذف بعد المدة |
|-------|--------|--------------|-----------------|----------------------|
| **رواتب وضرائب** | payroll, payroll_items, GOSI contributions, WPS records | **10 سنوات** من تاريخ الصرف | ZATCA — نظام ضريبة الدخل (م/1 لعام 1425هـ) + نظام الزكاة | ✅ |
| **GOSI / تأمينات** | gosi_deductions, wages_history | **طوال حياة الاشتراك + 7 سنوات** | نظام التأمينات الاجتماعية م/33 | ✅ |
| **عقود التوظيف** | employment_contracts, amendments | **5 سنوات من انتهاء العلاقة** | نظام العمل السعودي — المادة 9 | ✅ |
| **الحضور والانصراف** | attendance, attendance_adjustments | **سنتان في النظام الحي + أرشفة دائمة** | نظام العمل — إثبات ساعات العمل | ⚠️ أرشفة لا حذف |
| **الإجازات** | leave_requests, leave_balances | **3 سنوات بعد تاريخ الإجازة** | نظام العمل — المواد 109-119 | ✅ |
| **التقارير اليومية** | daily_reports + attachments | **3 سنوات** | أغراض أعمال داخلية | ✅ |
| **نزاعات عمالية** | أي سجلات مرتبطة بقضية مفتوحة/مغلقة | **5 سنوات من إغلاق القضية** | نظام العمل — المادة 222 | ✅ |
| **بيانات تعريف أساسية** | profiles (name, national_id, photo) | حتى انتهاء كل المدد أعلاه | لربط السجلات الاحتفاظية | ✅ |
| **إشعارات وطلبات داخلية** | notifications, employee_requests | **سنة واحدة** | لا التزام تنظيمي | ✅ |
| **دعوات معلّقة منتهية** | pending_invitations (status='expired') | **30 يوماً** ثم حذف | — | ✅ تلقائياً (cron) |
| **بيانات العضوية في منصات خارجية** | social accounts, OAuth tokens | يُحذف فوراً عند طلب الحذف | — | ✅ فوري |

---

## 3. إجراءات الحذف — دليل HR

### الخطوة 1: استقبال الطلب

- يظهر الطلب في صفحة `/requests` (admin) بأيقونة `delete_forever`
  ولون وردي، type = "طلب حذف بيانات (PDPL)"
- أيضاً يظهر في dashboard الإشعارات

### الخطوة 2: التحقق من الهوية

- تأكد أن `employee_id` في الطلب مطابق للموظف الفعلي
- راجع `profiles.national_id` + `profiles.email` للتطابق

### الخطوة 3: تحديد نطاق الحذف

راجع الجدول أعلاه لكل فئة بيانات للموظف:

```sql
-- كل جداول تحتوي employee_id للموظف المحدد
select table_name from information_schema.columns
where column_name in ('employee_id','user_id','profile_id')
  and table_schema = 'public';
```

### الخطوة 4: تنفيذ الحذف الجزئي

اطلب من المشرف التقني تنفيذ (بعد توقيع الاعتماد):

```sql
-- مثال على الحذف الجزئي (عدّل حسب حالة الموظف)
begin;

-- 1. بيانات ضمن مدة الاحتفاظ → يُبقى عليها
--    لا تفعل شيئاً

-- 2. بيانات خارج مدة الاحتفاظ → تُحذف
delete from notifications where user_id = '<UID>' and created_at < now() - interval '1 year';
delete from employee_requests where employee_id = '<UID>' and created_at < now() - interval '1 year' and type_key != 'dataErasure';
delete from daily_reports where employee_id = '<UID>' and date < current_date - interval '3 years';

-- 3. إذا انتهت علاقة العمل + كل المدد: حذف profile (آخر خطوة)
-- update profiles set deleted_at = now(), email = null, national_id = null, photo_url = null where id = '<UID>';

commit;
```

### الخطوة 5: توثيق الحذف

حدّث الطلب في `employee_requests`:

```sql
update employee_requests
set status = 'approved',
    reviewed_by = '<ADMIN_UID>',
    reviewed_at = now(),
    details_ar = details_ar || E'\n\n---\nتم الحذف في: ' || now()::date || E'\nما حُذف: ' || '<description>' || E'\nما أُبقي عليه: ' || '<description with legal basis>',
    details_en = details_en || E'\n\n---\nErased on: ' || now()::date || E'\nDeleted: ' || '<description>' || E'\nRetained: ' || '<description with legal basis>'
where id = '<REQUEST_ID>';
```

### الخطوة 6: إبلاغ الموظف

أرسل إشعاراً داخلياً + بريد إلكتروني يوضح:
- ما حُذف بالضبط
- ما يُحتفظ به والمبرر القانوني + تاريخ الحذف المخطط
- حقه في التظلّم لدى الجهة المختصة (الهيئة السعودية للبيانات والذكاء الاصطناعي — SDAIA)

---

## 4. طلبات خاصة

### 4.1 موظف حالي

- الحذف محظور حتى انتهاء العلاقة + انتهاء مدد الاحتفاظ
- يمكن فقط: تصحيح بيانات خاطئة (المادة 20 من PDPL)

### 4.2 موظف سابق (< 10 سنوات)

- حذف جزئي: كل ما لا يرتبط بـ GOSI/ZATCA/عقد
- احتفظ: سجلات الرواتب، GOSI، بيانات التعريف الأساسية

### 4.3 موظف سابق (> 10 سنوات)

- حذف شبه كامل: يُحتفظ فقط بالاسم + رقم الهوية + فترة العمل
  لأغراض إصدار شهادات الخبرة عند الحاجة

### 4.4 طلب عاجل (حادث أمني، تسرّب بيانات)

- تواصل فوري مع SDAIA (خلال 72 ساعة)
- حذف فوري للبيانات المتأثرة بإذن قانوني مستعجل

---

## 5. المسؤوليات

| الدور | المسؤولية |
|------|----------|
| **موظف** | تقديم طلب واضح عبر `/my-history` → "طلب حذف بياناتي" |
| **HR Admin** | مراجعة الطلب خلال 30 يوم، تحديد النطاق، توثيق القرار |
| **Technical Admin** | تنفيذ SQL بعد اعتماد HR |
| **Legal Counsel** | مراجعة الطلبات الخاصة أو المثيرة للجدل |
| **Data Protection Officer** | الإشراف على الامتثال لـ PDPL (إن وُجد) |

---

## 6. مراجعات دورية

- **سنوي**: مراجعة مدد الاحتفاظ مع تحديثات ZATCA/GOSI/نظام العمل
- **ربع سنوي**: تدقيق طلبات الحذف المنجزة للتأكد من التوثيق الكامل
- **cron تلقائي**: `archive_attendance()` شهرياً، `expire_stale_invitations()` يومياً

---

## 7. اتصال

- SDAIA (الهيئة السعودية للبيانات والذكاء الاصطناعي): https://sdaia.gov.sa
- خط شكاوى PDPL: 19966

---

**تم اعتماد هذه السياسة من:** المستشار القانوني لـ NJD Games
**تاريخ الاعتماد:** 2026-04-17
**المراجعة القادمة:** 2027-04-17
