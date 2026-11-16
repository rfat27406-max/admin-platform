
(() => {
  const titles = {
    dashboard: "نظرة عامة",
    teachers: "الأساتذة",
    "teacher-profile": "ملف الأستاذ بومدين",
    "teacher-space": "فضاء الأستاذ",
    groups: "الأفواج والحصص",
    students: "التلاميذ",
    payments: "المدفوعات",
    notifications: "الإشعارات"
  };

  const navLinks = [...document.querySelectorAll(".nav-link")];
  const pages = [...document.querySelectorAll(".page")];
  const title = document.getElementById("pageTitle");
  const crumb = document.getElementById("crumb");
  const sidebar = document.getElementById("sidebar");
  const toast = document.getElementById("toast");

  const API_BASE = "https://school-server.rfat27406.workers.dev";

  let toastTimer;
  let selectedTeacherGroupId = null;
  const ADMIN_TOKEN_KEY = "madrasati_admin_token_v2";
  let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  let teacherGroupsCache = [];
  let selectedTeacherId = "teacher-boumediene";

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        ...(options.headers || {})
      }
    });

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(
        payload.error || payload.message || `خطأ في الاتصال: ${response.status}`
      );
    }

    return payload;
  }

  function teacherApiPath(path) {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}teacher_id=${encodeURIComponent(selectedTeacherId)}`;
  }

  async function teacherApiRequest(path, options = {}) {
    return apiRequest(teacherApiPath(path), options);
  }

  async function showAdminLogin() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:#081329ee;display:grid;place-items:center;padding:20px;";
      overlay.innerHTML = `
        <form id="adminLoginForm" style="width:min(420px,100%);background:#fff;color:#17233d;border-radius:22px;padding:28px;box-shadow:0 24px 80px #0005;font-family:inherit">
          <div style="font-size:34px;margin-bottom:8px">🔐</div>
          <h2 style="margin:0 0 8px">دخول الإدارة</h2>
          <p style="color:#64748b;margin:0 0 20px">أدخل رمز المرور للمتابعة إلى لوحة الإدارة.</p>
          <input id="adminLoginPassword" type="password" inputmode="numeric" autocomplete="current-password" placeholder="رمز الإدارة" required style="width:100%;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font:inherit">
          <p id="adminLoginError" style="color:#dc2626;min-height:22px"></p>
          <button type="submit" style="width:100%;padding:14px;border:0;border-radius:12px;background:#1d4ed8;color:white;font:inherit;font-weight:700;cursor:pointer">دخول آمن</button>
        </form>`;
      document.body.appendChild(overlay);
      const form = overlay.querySelector("#adminLoginForm");
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button");
        const errorNode = overlay.querySelector("#adminLoginError");
        button.disabled = true;
        try {
          const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: overlay.querySelector("#adminLoginPassword").value })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "تعذر تسجيل الدخول.");
          adminToken = payload.access_token;
          sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
          overlay.remove();
          resolve(true);
        } catch (error) {
          errorNode.textContent = error.message;
          button.disabled = false;
        }
      });
      overlay.querySelector("#adminLoginPassword").focus();
    });
  }

  async function ensureAdminSession() {
    if (adminToken) {
      try {
        await apiRequest("/api/admin/summary");
        return true;
      } catch {
        adminToken = "";
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    }
    return showAdminLogin();
  }

  function navigate(page) {
    if (!titles[page]) return;

    navLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.page === page);
    });

    pages.forEach(section => {
      section.classList.toggle("active", section.id === `page-${page}`);
    });

    if (title) title.textContent = titles[page];
    if (crumb) crumb.textContent = titles[page];

    if (sidebar) sidebar.classList.remove("open");

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (page === "teacher-space") {
      loadTeacherSpace();
    }
  }

  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      navigate(link.dataset.page);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
      navigate(button.dataset.goto);
    });
  });

  document.getElementById("sendAdminNotification")?.addEventListener("click", async () => {
    const title = document.getElementById("adminNotificationTitle")?.value.trim();
    const message = document.getElementById("adminNotificationMessage")?.value.trim();
    const audience = document.getElementById("adminNotificationAudience")?.value || "all";
    const studentId = document.getElementById("adminNotificationStudent")?.value || "";

    if (!title || !message) {
      showToast("أدخل عنوان الإشعار ونصه أولاً.");
      return;
    }
    if (audience === "student" && !studentId) {
      showToast("اختر التلميذ الذي تريد إرسال الإشعار إليه.");
      return;
    }

    const button = document.getElementById("sendAdminNotification");
    if (button) { button.disabled = true; button.textContent = "جارٍ النشر..."; }

    try {
      const result = await apiRequest("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          title, message, audience,
          ...(audience === "student" ? { student_id: studentId } : {})
        })
      });
      showToast(result.message || "تم نشر الإشعار داخل المنصة.");
      document.getElementById("adminNotificationTitle").value = "";
      document.getElementById("adminNotificationMessage").value = "";
      await loadAdminNotifications();
    } catch (error) {
      showToast(error.message);
    } finally {
      if (button) { button.disabled = false; button.textContent = "＋ نشر الإشعار"; }
    }
  });

  document.getElementById("adminNotificationAudience")?.addEventListener("change", event => {
    const row = document.getElementById("adminNotificationStudentRow");
    if (row) row.classList.toggle("hidden", event.target.value !== "student");
  });


  document.getElementById("menuToggle")?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });

  document.getElementById("topNotification")?.addEventListener("click", () => {
    navigate("notifications");
  });

  document.getElementById("addTeacher")?.addEventListener("click", async () => {
    const name = prompt("اسم الأستاذ:");
    if (!name) return;
    const subject = prompt("المادة:");
    if (!subject) return;
    const level = prompt("المستوى الدراسي (مثال: الطور الثانوي):", "الطور الثانوي");
    if (!level) return;
    const password = prompt("كلمة مرور فضاء الأستاذ (6 أحرف على الأقل):");
    if (!password) return;
    try {
      const result = await apiRequest("/api/admin/teachers", {
        method: "POST",
        body: JSON.stringify({ name, subject, education_level: level, password })
      });
      showToast(`تم إنشاء فضاء ${name}. رابط الدخول: teacher.html?teacher=${result.teacher.id}`);
      selectedTeacherId = result.teacher.id;
      await loadTeachersTable();
      const selector = document.getElementById("teacherSpaceSelect");
      if (selector) selector.value = selectedTeacherId;
    } catch (error) { showToast(error.message); }
  });

  document.getElementById("addGroup")?.addEventListener("click", async () => {
    try {
      const { teachers = [] } = await apiRequest("/api/teachers");
      const choices = teachers.map(t => `${t.id} = ${t.name}`).join("\\n");
      const teacherId = prompt(`معرّف الأستاذ الذي سيملك الفوج:\\n${choices}`, teachers[0]?.id || "");
      if (!teacherId) return;
      const name = prompt("اسم الفوج:");
      if (!name) return;
      const weekday = prompt("اليوم: friday أو saturday", "friday");
      const start_time = prompt("وقت البداية بصيغة HH:MM", "08:00");
      const end_time = prompt("وقت النهاية بصيغة HH:MM", "10:00");
      const price_dzd = Number(prompt("سعر الحصة بالدينار:", "300"));
      await apiRequest("/api/admin/groups", {
        method: "POST",
        body: JSON.stringify({ teacher_id: teacherId, name, weekday, start_time, end_time, price_dzd })
      });
      showToast("تمت إضافة الفوج بنجاح.");
      await loadGroupsFromServer();
    } catch (error) { showToast(error.message); }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      sidebar?.classList.remove("open");
    }
  });

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function weekdayArabic(value) {
    if (value === "friday") return "الجمعة";
    if (value === "saturday") return "السبت";
    return value || "—";
  }

  function groupName(value) {
    const name = String(value || "");
    return name.startsWith("الفوج") ? name : (name ? `الفوج ${name}` : "فوج");
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = String(value).slice(0, 10);
    const parts = date.split("-");

    if (parts.length !== 3) return escapeHTML(value);

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function formatMoney(value) {
    return `${Number(value || 0).toLocaleString("ar-DZ")} دج`;
  }

  // ==========================================
  // تحميل الأفواج في لوحة الإدارة العامة
  // ==========================================

  async function loadGroupsFromServer() {
    try {
      const payload = await apiRequest("/api/groups");
      const groups = Array.isArray(payload.groups) ? payload.groups : [];

      const groupRows = groups.map(group => `
        <tr>
          <td><b>${escapeHTML(groupName(group.name))}</b></td>
          <td>${escapeHTML(weekdayArabic(group.weekday))}</td>
          <td>${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}</td>
          <td>${escapeHTML(group.teacher_name || "—")}</td>
          <td>${escapeHTML(group.price_dzd)} دج</td>
          <td>${escapeHTML(group.subject || "—")}</td>
        </tr>
      `).join("");

      const groupTbody = document.querySelector("#page-groups table tbody");

      if (groupTbody) {
        groupTbody.innerHTML = groupRows ||
          '<tr><td colspan="6">لا توجد أفواج نشطة حالياً.</td></tr>';
      }

      const profileTbody = document.querySelector("#page-teacher-profile table tbody");

      if (profileTbody) {
        profileTbody.innerHTML = groups.map(group => `
          <tr>
            <td><b>${escapeHTML(groupName(group.name))}</b></td>
            <td>${escapeHTML(weekdayArabic(group.weekday))}</td>
            <td>${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}</td>
            <td>علوم طبيعية</td>
            <td>${escapeHTML(group.price_dzd)} دج</td>
            <td><span class="status status-active">نشط</span></td>
          </tr>
        `).join("") ||
          '<tr><td colspan="6">لا توجد أفواج نشطة حالياً.</td></tr>';
      }

      const scheduleList = document.querySelector("#page-dashboard .schedule-list");

      if (scheduleList) {
        scheduleList.innerHTML = groups.map(group => `
          <div class="schedule-row">
            <span class="day-badge">${escapeHTML(weekdayArabic(group.weekday))}</span>
            <div class="schedule-info">
              <b>${escapeHTML(groupName(group.name))}</b>
              <small>${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}</small>
            </div>
            <span class="subject">${escapeHTML(group.subject || "—")}</span>
          </div>
        `).join("") ||
          '<p class="empty-hint">لا توجد أفواج نشطة حالياً.</p>';
      }

      const groupCount = document.querySelector(
        "#page-teacher-profile .profile-stats .stat-card strong"
      );

      if (groupCount) {
        groupCount.textContent = String(groups.length).padStart(2, "0");
      }

      const dashboardGroupStat = [
        ...document.querySelectorAll("#page-dashboard .stat-card")
      ].find(card =>
        card.querySelector(".stat-label")?.textContent.trim() === "الأفواج"
      );

      if (dashboardGroupStat) {
        const value = dashboardGroupStat.querySelector("strong");
        if (value) value.textContent = String(groups.length).padStart(2, "0");
      }

    } catch (error) {
      console.error("تعذر تحميل الأفواج:", error);
      showToast("تعذر تحميل الأفواج من السيرفر.");
    }
  }

  async function loadTeachersTable() {
    try {
      const { teachers = [] } = await apiRequest("/api/teachers");
      const tbody = document.getElementById("teachersTableBody");
      if (!tbody) return;
      tbody.innerHTML = teachers.map(teacher => `
        <tr>
          <td><div class="person-cell"><span class="table-avatar">${escapeHTML((teacher.name || "أ").slice(0,1))}</span><b>${escapeHTML(teacher.name)}</b></div></td>
          <td>${escapeHTML(teacher.subject)}</td><td>${escapeHTML(teacher.education_level)}</td>
          <td>${escapeHTML(teacher.groups_count ?? 0)}</td>
          <td><span class="status status-active">نشط</span></td>
          <td>
            <button class="text-btn" type="button" data-open-teacher-space="${escapeHTML(teacher.id)}">فتح الفضاء</button>
            <button class="text-btn" type="button" data-set-teacher-password="${escapeHTML(teacher.id)}">كلمة المرور</button>
          </td>
        </tr>
      `).join("") || '<tr><td colspan="6">لا يوجد أساتذة بعد.</td></tr>';

      const selector = document.getElementById("teacherSpaceSelect");
      if (selector) {
        const previous = selectedTeacherId;
        selector.innerHTML = teachers.map(teacher =>
          `<option value="${escapeHTML(teacher.id)}">${escapeHTML(teacher.name)} · ${escapeHTML(teacher.subject)}</option>`
        ).join("");
        if (teachers.some(teacher => teacher.id === previous)) {
          selector.value = previous;
        } else if (teachers.length) {
          selectedTeacherId = teachers[0].id;
          selector.value = selectedTeacherId;
        }
      }
    } catch (error) { showToast(error.message); }
  }

  document.getElementById("teachersTableBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-open-teacher-space]");
    if (!button) return;
    selectedTeacherId = button.dataset.openTeacherSpace;
    const selector = document.getElementById("teacherSpaceSelect");
    if (selector) selector.value = selectedTeacherId;
    navigate("teacher-space");
  });

  document.getElementById("teacherSpaceSelect")?.addEventListener("change", event => {
    selectedTeacherId = event.target.value;
    loadTeacherSpace();
  });

  document.getElementById("teachersTableBody")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-set-teacher-password]");
    if (!button) return;
    const password = prompt("كلمة المرور الجديدة للأستاذ (6 أحرف على الأقل):");
    if (!password) return;
    try {
      await apiRequest(`/api/admin/teachers/${encodeURIComponent(button.dataset.setTeacherPassword)}/password`, {
        method: "POST", body: JSON.stringify({ password })
      });
      showToast("تم تحديث كلمة المرور.");
    } catch (error) { showToast(error.message); }
  });

  async function loadAdminNotifications() {
    const list = document.getElementById("adminNotificationsList");
    if (!list) return;
    try {
      const [{ notifications = [] }, { students = [] }] = await Promise.all([
        apiRequest("/api/admin/notifications"),
        apiRequest("/api/admin/students")
      ]);

      const studentSelect = document.getElementById("adminNotificationStudent");
      if (studentSelect) {
        const current = studentSelect.value;
        studentSelect.innerHTML = '<option value="">اختر التلميذ</option>' +
          students.map(student =>
            `<option value="${escapeHTML(student.id)}">${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}</option>`
          ).join("");
        if (students.some(student => student.id === current)) studentSelect.value = current;
      }

      list.innerHTML = notifications.map(item => `
        <article class="notification-history-item" style="padding:14px;border:1px solid #e5eaf2;border-radius:12px;margin-top:10px">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <b>${escapeHTML(item.title)}</b>
            <small>${escapeHTML(item.recipient_name || "المستلم")} · ${escapeHTML(formatDate(item.created_at))}</small>
          </div>
          <p style="margin:8px 0 0;white-space:pre-wrap">${escapeHTML(item.message)}</p>
        </article>
      `).join("") || '<p class="empty-hint">لا توجد إشعارات منشورة بعد.</p>';
    } catch (error) {
      list.innerHTML = `<p class="empty-hint">${escapeHTML(error.message)}</p>`;
    }
  }

  // ==========================================
  // تحميل التلاميذ في لوحة الإدارة العامة
  // ==========================================

  document.getElementById("studentsTableBody")?.addEventListener("click", async event => {
    const approve = event.target.closest("[data-student-approve]");
    const reject = event.target.closest("[data-student-reject]");
    const button = approve || reject;
    if (!button) return;
    const action = approve ? "approve" : "reject";
    const studentId = button.dataset[approve ? "studentApprove" : "studentReject"];
    const promptText = action === "approve"
      ? "هل تريد قبول طلب تفعيل هذا التلميذ؟"
      : "هل تريد رفض طلب تفعيل هذا التلميذ؟";
    if (!window.confirm(promptText)) return;
    button.disabled = true;
    try {
      const result = await apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}/${action}`, { method: "POST" });
      showToast(result.message || "تم تحديث طلب التلميذ.");
      await loadStudentsFromServer();
    } catch (error) {
      showToast(error.message);
      button.disabled = false;
    }
  });

  async function loadStudentsFromServer() {
    try {
      const payload = await apiRequest("/api/admin/students");
      const students = Array.isArray(payload.students) ? payload.students : [];

      const tbody = document.getElementById("studentsTableBody");

      if (tbody) {
        tbody.innerHTML = students.map(student => `
          <tr>
            <td>
              <b>${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}</b>
            </td>
            <td>${escapeHTML(student.age)} سنة</td>
            <td>${formatDate(student.created_at)}</td>
            <td>
              <span class="status ${student.approval_status === "approved" ? "status-active" : "status-pending"}">
                ${student.approval_status === "approved" ? "مفعل" : student.approval_status === "pending" ? "بانتظار التفعيل" : student.approval_status === "locked" ? "مرفوض نهائياً" : `مرفوض · ${student.rejection_count}/3`}
              </span>
            </td>
            <td>${escapeHTML(student.bookings_count ?? 0)}</td>
            <td>
              <span class="status status-active">
                ${escapeHTML(student.paid_count ?? 0)}
              </span>
            </td>
            <td>
              <span class="status status-pending">
                ${escapeHTML(student.unpaid_count ?? 0)}
              </span>
            </td>
            <td>
              ${student.approval_status === "pending" ? `
                <button class="text-btn" type="button" data-student-approve="${escapeHTML(student.id)}">قبول</button>
                <button class="text-btn" type="button" data-student-reject="${escapeHTML(student.id)}">رفض</button>
              ` : "—"}
            </td>
          </tr>
        `).join("") ||
          '<tr><td colspan="8">لا يوجد تلاميذ مسجلون حالياً.</td></tr>';
      }

      const totalBookings = students.reduce(
        (sum, student) => sum + Number(student.bookings_count || 0), 0
      );

      const totalPaid = students.reduce(
        (sum, student) => sum + Number(student.paid_count || 0), 0
      );

      const totalUnpaid = students.reduce(
        (sum, student) => sum + Number(student.unpaid_count || 0), 0
      );

      setText("studentsTotal", students.length);
      setText("studentsBookings", totalBookings);
      setText("studentsPaid", totalPaid);
      setText("studentsUnpaid", totalUnpaid);
      setText("dashboardStudentsCount", String(students.length).padStart(2, "0"));

    } catch (error) {
      console.error("تعذر تحميل التلاميذ:", error);

      const tbody = document.getElementById("studentsTableBody");

      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="8">تعذر تحميل البيانات. تحقق من اتصال السيرفر.</td></tr>';
      }

      showToast("تعذر تحميل التلاميذ من السيرفر.");
    }
  }

  // ==========================================
  // فضاء الأستاذ: الملخص المالي
  // ==========================================

  async function loadTeacherSummary() {
    const [teacherPayload, adminPayload] = await Promise.all([
      teacherApiRequest("/api/teacher/summary"),
      apiRequest("/api/admin/summary")
    ]);
    const summary = teacherPayload.summary || {};
    const all = adminPayload.summary || {};

    setText("teacherStudentsCount", summary.students_count ?? 0);
    setText("teacherBookingsCount", summary.bookings_count ?? 0);
    setText("teacherPaidCount", summary.paid_count ?? 0);
    setText("teacherRevenue", formatMoney(summary.total_revenue));

    // إجمالي المؤسسة يجمع مداخيل جميع الأساتذة.
    setText("dashboardRevenue", formatMoney(all.total_revenue));
    setText("adminPaidCount", all.paid_count ?? 0);
    setText("adminRevenue", formatMoney(all.total_revenue));
    setText("adminUnpaidCount", all.unpaid_count ?? 0);
    setText("dashboardTeachersCount", all.teachers_count ?? 0);
    setText("dashboardGroupsCount", all.groups_count ?? 0);

    return summary;
  }

  // ==========================================
  // فضاء الأستاذ: تحميل الأفواج
  // ==========================================

  async function loadTeacherGroups() {
    const payload = await teacherApiRequest("/api/teacher/groups");
    teacherGroupsCache = Array.isArray(payload.groups) ? payload.groups : [];

    const container = document.getElementById("teacherGroupsGrid");
    if (!container) return;

    if (!teacherGroupsCache.length) {
      container.innerHTML = "<p>لا توجد أفواج متاحة.</p>";
      return;
    }

    container.innerHTML = teacherGroupsCache.map(group => `
      <article class="stat-card">
        <div class="stat-top">
          <span class="stat-icon purple">▤</span>
          <span class="stat-note">${escapeHTML(weekdayArabic(group.weekday))}</span>
        </div>

        <p class="stat-label">${escapeHTML(groupName(group.name))}</p>
        <strong>${escapeHTML(group.bookings_count ?? 0)}</strong>
        <small>حجز مسجل</small>

        <div style="margin-top:14px;">
          <small>
            ${escapeHTML(group.start_time)} — ${escapeHTML(group.end_time)}
          </small>
          <br>
          <small>سعر الحصة: ${escapeHTML(group.price_dzd)} دج</small>
        </div>

        <button
          type="button"
          class="primary-btn"
          style="width:100%; margin-top:14px;"
          data-teacher-group-id="${escapeHTML(group.id)}"
        >
          فتح الفوج
        </button>
      </article>
    `).join("");
  }

  // ==========================================
  // فضاء الأستاذ: تحميل تلاميذ فوج محدد
  // ==========================================

  async function loadTeacherGroupStudents(groupId) {
    const details = document.getElementById("teacherGroupDetails");
    const tbody = document.getElementById("teacherGroupStudentsBody");

    if (!details || !tbody) return;

    selectedTeacherGroupId = Number(groupId);

    details.style.display = "block";
    details.scrollIntoView({ behavior: "smooth", block: "start" });

    tbody.innerHTML =
      '<tr><td colspan="7">جارٍ تحميل تلاميذ الفوج...</td></tr>';

    const group = teacherGroupsCache.find(
      item => Number(item.id) === Number(groupId)
    );

    setText(
      "teacherSelectedGroup",
      group ? groupName(group.name) : "تلاميذ الفوج"
    );

    try {
      const payload = await apiRequest(
        teacherApiPath(`/api/teacher/groups/${encodeURIComponent(groupId)}/students`)
      );

      const students = Array.isArray(payload.students) ? payload.students : [];
      const groupInfo = payload.group || {};
      const summary = payload.summary || {};

      setText(
        "teacherSelectedGroup",
        groupName(groupInfo.name || group?.name)
      );

      setText(
        "teacherSelectedGroupInfo",
        `${weekdayArabic(groupInfo.weekday)} · ${groupInfo.start_time || ""} — ${groupInfo.end_time || ""}`
      );

      setText("teacherGroupBookings", summary.students_count ?? students.length);
      setText("teacherGroupPaid", summary.paid_count ?? 0);
      setText("teacherGroupUnpaid", summary.unpaid_count ?? 0);
      setText("teacherGroupRevenue", formatMoney(summary.revenue));

      if (!students.length) {
        tbody.innerHTML =
          '<tr><td colspan="7">لا يوجد تلاميذ مسجلون في هذا الفوج حالياً.</td></tr>';
        return;
      }

      tbody.innerHTML = students.map(student => {
        const isPaid = student.payment_status === "paid";
        const isCancelled = student.status === "cancelled";

        let paymentLabel = isPaid ? "مدفوع" : "غير مدفوع";
        let paymentClass = isPaid ? "status-active" : "status-pending";

        const buttonHTML = isPaid
          ? '<span class="status status-active">تم استلام المبلغ</span>'
          : isCancelled
            ? '<span class="muted-chip">حجز ملغى</span>'
            : `
              <button
                type="button"
                class="primary-btn"
                data-pay-booking="${escapeHTML(student.booking_id)}"
                data-student-name="${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}"
              >
                تأكيد استلام 300 دج
              </button>
            `;

        return `
          <tr>
            <td>
              <b>${escapeHTML(student.first_name)} ${escapeHTML(student.last_name)}</b>
            </td>
            <td>${escapeHTML(student.age)} سنة</td>
            <td>${formatDate(student.session_date)}</td>
            <td>${escapeHTML(student.status || "registered")}</td>
            <td><span class="status ${paymentClass}">${paymentLabel}</span></td>
            <td>${escapeHTML(student.price_dzd ?? 300)} دج</td>
            <td>${buttonHTML}</td>
          </tr>
        `;
      }).join("");

    } catch (error) {
      console.error("تعذر تحميل تلاميذ الفوج:", error);

      tbody.innerHTML =
        `<tr><td colspan="7">${escapeHTML(error.message || "تعذر تحميل التلاميذ.")}</td></tr>`;

      showToast("تعذر تحميل تلاميذ هذا الفوج.");
    }
  }

  // ==========================================
  // فضاء الأستاذ: تأكيد استلام الدفع
  // ==========================================

  async function confirmTeacherPayment(bookingId, studentName, button) {
    if (!bookingId) return;

    const confirmed = window.confirm(
      `هل تؤكد استلام مبلغ 300 دج من التلميذ ${studentName}؟`
    );

    if (!confirmed) return;

    if (button) {
      button.disabled = true;
      button.textContent = "جارٍ تأكيد الدفع...";
    }

    try {
      const payload = await apiRequest(
        teacherApiPath(`/api/teacher/bookings/${encodeURIComponent(bookingId)}/pay`),
        { method: "POST" }
      );

      showToast(payload.message || "تم تأكيد الدفع بنجاح.");

      // تحديث بيانات الفوج والملخص المالي
      await Promise.all([
        loadTeacherGroupStudents(selectedTeacherGroupId),
        loadTeacherSummary(),
        loadStudentsFromServer()
      ]);

      // تحديث عدد الحجوزات المعروضة في بطاقات الأفواج
      await loadTeacherGroups();

    } catch (error) {
      console.error("تعذر تأكيد الدفع:", error);

      showToast(error.message || "تعذر تأكيد الدفع.");

      if (button) {
        button.disabled = false;
        button.textContent = "تأكيد استلام 300 دج";
      }
    }
  }

  // ==========================================
  // أحداث فضاء الأستاذ
  // ==========================================

  document.getElementById("teacherGroupsGrid")?.addEventListener("click", event => {
    const button = event.target.closest("[data-teacher-group-id]");
    if (!button) return;

    loadTeacherGroupStudents(button.dataset.teacherGroupId);
  });

  document.getElementById("teacherGroupStudentsBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-pay-booking]");
    if (!button) return;

    confirmTeacherPayment(
      button.dataset.payBooking,
      button.dataset.studentName,
      button
    );
  });

  document.getElementById("teacherRefreshGroup")?.addEventListener("click", () => {
    if (selectedTeacherGroupId !== null) {
      loadTeacherGroupStudents(selectedTeacherGroupId);
    }
  });

  // ==========================================
  // تحميل فضاء الأستاذ
  // ==========================================

  async function loadTeacherSpace() {
    const grid = document.getElementById("teacherGroupsGrid");
    const selectedOption = document.getElementById("teacherSpaceSelect")?.selectedOptions?.[0];
    const heading = document.getElementById("teacherSpaceHeading");
    if (heading) heading.textContent = `فضاء ${selectedOption?.textContent.split(" · ")[0] || "الأستاذ"}`;
    teacherGroupsCache = [];

    if (grid && teacherGroupsCache.length === 0) {
      grid.innerHTML = "<p>جارٍ تحميل الأفواج...</p>";
    }

    try {
      await Promise.all([
        loadTeacherSummary(),
        loadTeacherGroups()
      ]);
    } catch (error) {
      console.error("تعذر تحميل فضاء الأستاذ:", error);
      showToast("تعذر تحميل بيانات فضاء الأستاذ.");
    }
  }

  // ==========================================
  // تشغيل تحميل البيانات
  // ==========================================

  (async () => {
    await ensureAdminSession();
    await Promise.all([
      loadGroupsFromServer(),
      loadStudentsFromServer(),
      loadTeachersTable(),
      loadAdminNotifications(),
      loadTeacherSummary().catch(error => console.error("تعذر تحميل الملخص المالي:", error))
    ]);
  })();

})();
