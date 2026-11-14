
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
  let teacherGroupsCache = [];

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

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });

  document.getElementById("topNotification")?.addEventListener("click", () => {
    navigate("notifications");
  });

  document.getElementById("addTeacher")?.addEventListener("click", () => {
    showToast("إضافة الأستاذ ستُفعّل في مرحلة إدارة الأساتذة.");
  });

  document.getElementById("addGroup")?.addEventListener("click", () => {
    showToast("إضافة فوج ستُفعّل في مرحلة إدارة الأفواج.");
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
          <td>بومدين</td>
          <td>${escapeHTML(group.price_dzd)} دج</td>
          <td>علوم طبيعية</td>
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
            <span class="subject">علوم طبيعية</span>
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

  // ==========================================
  // تحميل التلاميذ في لوحة الإدارة العامة
  // ==========================================

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
          </tr>
        `).join("") ||
          '<tr><td colspan="6">لا يوجد تلاميذ مسجلون حالياً.</td></tr>';
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
          '<tr><td colspan="6">تعذر تحميل البيانات. تحقق من اتصال السيرفر.</td></tr>';
      }

      showToast("تعذر تحميل التلاميذ من السيرفر.");
    }
  }

  // ==========================================
  // فضاء الأستاذ: الملخص المالي
  // ==========================================

  async function loadTeacherSummary() {
    const payload = await apiRequest("/api/teacher/summary");
    const summary = payload.summary || {};

    setText("teacherStudentsCount", summary.students_count ?? 0);
    setText("teacherBookingsCount", summary.bookings_count ?? 0);
    setText("teacherPaidCount", summary.paid_count ?? 0);
    setText("teacherRevenue", formatMoney(summary.total_revenue));

    // تحديث لوحة الإدارة العامة
    setText("dashboardRevenue", formatMoney(summary.total_revenue));

    // تحديث صفحة المدفوعات
    setText("adminPaidCount", summary.paid_count ?? 0);
    setText("adminRevenue", formatMoney(summary.total_revenue));
    setText("adminUnpaidCount", summary.unpaid_count ?? 0);

    return summary;
  }

  // ==========================================
  // فضاء الأستاذ: تحميل الأفواج
  // ==========================================

  async function loadTeacherGroups() {
    const payload = await apiRequest("/api/teacher/groups");
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
        `/api/teacher/groups/${encodeURIComponent(groupId)}/students`
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
        `/api/teacher/bookings/${encodeURIComponent(bookingId)}/pay`,
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

  loadGroupsFromServer();
  loadStudentsFromServer();
  loadTeacherSummary().catch(error => {
    console.error("تعذر تحميل الملخص المالي:", error);
  });

})();
