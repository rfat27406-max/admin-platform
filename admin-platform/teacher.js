const API = "https://school-server.rfat27406.workers.dev";
const $ = id => document.getElementById(id);
let token = sessionStorage.getItem("madrasati_teacher_token") || "";
let teacher = null, selectedGroup = null;
const requestedTeacherId = new URLSearchParams(location.search).get("teacher");
if (requestedTeacherId) $("teacherId").value = requestedTeacherId;
async function api(path, options={}) {
  const response = await fetch(API + path, { ...options, headers: {
    "Content-Type":"application/json",
    ...(token ? {Authorization:`Bearer ${token}`} : {}),
    ...(options.headers || {})
  }});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "تعذر تنفيذ الطلب.");
  return data;
}
const money = n => `${Number(n||0).toLocaleString("ar-DZ")} دج`;
const day = d => d === "friday" ? "الجمعة" : "السبت";
const safe = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
$("loginForm").addEventListener("submit", async e=>{
  e.preventDefault(); $("loginError").textContent="";
  try {
    const data=await api("/api/teacher/login",{method:"POST",body:JSON.stringify({
      teacher_id:$("teacherId").value.trim(),password:$("teacherPassword").value
    })});
    token=data.access_token; teacher=data.teacher;
    sessionStorage.setItem("madrasati_teacher_token",token);
    await showApp();
  } catch(err){$("loginError").textContent=err.message;}
});
async function showApp(){
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
  $("teacherName").textContent=teacher?.name || "فضاء الأستاذ";
  await Promise.all([loadSummary(),loadGroups(),loadPayments()]);
}
async function loadSummary(){
  const {summary={}}=await api("/api/teacher/summary");
  $("studentsCount").textContent=summary.students_count||0;
  $("bookingsCount").textContent=summary.bookings_count||0;
  $("paidCount").textContent=summary.paid_count||0;
  $("revenue").textContent=money(summary.total_revenue);
}
async function loadGroups(){
  const {groups=[]}=await api("/api/teacher/groups");
  $("groups").innerHTML=groups.map(g=>`<article class="stat"><b>${safe(g.name)}</b><p>${day(g.weekday)} · ${safe(g.start_time)}–${safe(g.end_time)}</p><p>${money(g.price_dzd)} للحصة · ${g.bookings_count} حجز</p><button class="btn light" data-group="${g.id}">عرض التلاميذ</button></article>`).join("") || "<p>لا توجد أفواج بعد.</p>";
}
async function loadPayments(){
  const {payments=[]}=await api("/api/teacher/payments");
  $("paymentRows").innerHTML=payments.map(p=>`<tr>
    <td>${safe(p.first_name)} ${safe(p.last_name)}</td>
    <td>${safe(p.group_name)}</td>
    <td>${safe(p.session_date)}</td>
    <td>${p.payment_status==="paid"?"مدفوع":"غير مدفوع"}</td>
    <td>${safe(p.paid_at || "—")}</td>
    <td>${money(p.price_dzd)}</td>
  </tr>`).join("") || "<tr><td colspan='6'>لا توجد مدفوعات بعد.</td></tr>";
}
$("groups").addEventListener("click",e=>{
  const b=e.target.closest("[data-group]");if(b)loadStudents(Number(b.dataset.group));
});
async function loadStudents(id){
  selectedGroup=id;$("studentsPanel").classList.remove("hidden");$("studentRows").innerHTML="<tr><td colspan='6'>جار التحميل...</td></tr>";
  const data=await api(`/api/teacher/groups/${id}/students`),g=data.group,s=data.summary||{};
  $("groupTitle").textContent=g.name;$("groupMeta").textContent=`${day(g.weekday)} · ${g.start_time}–${g.end_time}`;
  $("groupBookings").textContent=s.students_count||0;$("groupPaid").textContent=s.paid_count||0;$("groupUnpaid").textContent=s.unpaid_count||0;$("groupRevenue").textContent=money(s.revenue);
  $("studentRows").innerHTML=(data.students||[]).map(x=>`<tr><td>${safe(x.first_name)} ${safe(x.last_name)}</td><td>${x.age}</td><td>${safe(x.session_date)}</td><td>${x.payment_status==="paid"?"مدفوع":"غير مدفوع"}</td><td>${money(x.price_dzd)}</td><td>${x.payment_status==="paid"?"—":`<button class="btn" data-pay="${safe(x.booking_id)}" data-name="${safe(x.first_name)} ${safe(x.last_name)}">تأكيد الدفع</button>`}</td></tr>`).join("") || "<tr><td colspan='6'>لا يوجد تلاميذ مسجلون.</td></tr>";
  $("studentsPanel").scrollIntoView({behavior:"smooth"});
}
$("studentRows").addEventListener("click",async e=>{
  const b=e.target.closest("[data-pay]");if(!b)return;
  if(!confirm(`تأكيد استلام الدفع من ${b.dataset.name}؟`))return;
  b.disabled=true;
  try{await api(`/api/teacher/bookings/${encodeURIComponent(b.dataset.pay)}/pay`,{method:"POST"});await Promise.all([loadStudents(selectedGroup),loadSummary(),loadGroups(),loadPayments()]);}
  catch(err){alert(err.message);b.disabled=false;}
});
$("refreshGroup").addEventListener("click",()=>selectedGroup&&loadStudents(selectedGroup));
$("addGroup").addEventListener("click",async()=>{
  const name=prompt("اسم الفوج:");if(!name)return;
  const weekday=prompt("اليوم: friday أو saturday","friday");
  const start_time=prompt("وقت البداية HH:MM","08:00");
  const end_time=prompt("وقت النهاية HH:MM","10:00");
  const price_dzd=Number(prompt("سعر الحصة بالدينار","300"));
  try{await api("/api/teacher/groups",{method:"POST",body:JSON.stringify({name,weekday,start_time,end_time,price_dzd})});await loadGroups();}
  catch(err){alert(err.message);}
});
$("logout").addEventListener("click",()=>{sessionStorage.removeItem("madrasati_teacher_token");token="";location.reload();});
if(token){sessionStorage.removeItem("madrasati_teacher_token");token="";}
