import React, { useMemo, useState } from "react";
import * as lucide from "lucide-react";

/**
 * NOTE: For PDF download, install once:
 *   npm i jspdf
 * The code uses dynamic import, so it won’t bloat your bundle.
 */

interface ContestRulesProps {
  contestType?: string;
  onClose?: () => void;
  onAgree?: () => void; // optional callback when user agrees
}

const Rules: React.FC<ContestRulesProps> = ({
  contestType = "General",
  onClose,
  onAgree,
}) => {
  const [activeSection, setActiveSection] = useState<
    keyof RulesMapKey | string
  >("eligibility");
  const [agree, setAgree] = useState(false);

  type Section = {
    title: string;
    icon: JSX.Element;
    rules: string[];
  };
  type RulesMapKey = {
    eligibility: Section;
    participation: Section;
    examIntegrity: Section;
    submissions: Section;
    tech: Section;
    scoring: Section;
    prizes: Section;
    support: Section;
  };

  const rulesData: RulesMapKey = useMemo(
    () => ({
      eligibility: {
        title: "Eligibility (12+)",
        icon: <lucide.Users size={20} />,
        rules: [
          "Participants must be 12 years or older.",
          "School/college students can join from any recognized board/institute.",
          "Each participant must use only one account; multiple accounts will lead to disqualification.",
          "Basic identity verification may be required before or after the contest.",
          "For team events (if applicable), team size and composition must follow the contest announcement.",
        ],
      },
      participation: {
        title: "Participation & Timing",
        icon: <lucide.Target size={20} />,
        rules: [
          "Register before the deadline and join the contest room at least 5 minutes early.",
          "Read the paper format and marking scheme shown on the contest page.",
          "Late entry grace window is 5 minutes (if enabled). After that, joining may be blocked.",
          "Once started, the timer will not pause except for system-wide issues declared by organizers.",
          "If the contest has multiple rounds, qualifying rules will be clearly stated on the round page.",
        ],
      },
      examIntegrity: {
        title: "Academic Integrity (Anti-Cheating)",
        icon: <lucide.Shield size={20} />,
        rules: [
          "Do not use external help, books, notes, or AI tools unless explicitly allowed.",
          "Avoid tab switching, copy/paste, screen sharing, or running multiple sessions.",
          "If proctoring is enabled, keep your camera/mic on when prompted.",
          "Any suspicious behavior (detected by our system or proctors) can lead to warnings or removal.",
          "Impersonation or using someone else’s account will result in immediate disqualification.",
        ],
      },
      submissions: {
        title: "Answers & Submissions",
        icon: <lucide.Upload size={20} />,
        rules: [
          "Submit answers within the allotted time. Late submissions are not accepted.",
          "Follow the exact answer format (MCQ selection, short answers, or uploads) as instructed.",
          "If an upload is required, ensure the file is readable and virus-free.",
          "Multiple submissions (if allowed) will consider only the latest one before time ends.",
          "Plagiarized or duplicate answers across accounts may be voided.",
        ],
      },
      tech: {
        title: "Device & Network",
        icon: <lucide.Laptop size={20} />,
        rules: [
          "Use a stable internet connection (minimum ~1 Mbps recommended).",
          "Supported browsers: latest Chrome/Edge/Firefox; enable cookies and JavaScript.",
          "Keep your device charged; plug in during the contest to avoid power loss.",
          "Disable VPNs, download managers, and notifications that can interrupt the session.",
          "If you face a genuine outage, rejoin quickly; organizers may review logs for relief on a case-by-case basis.",
        ],
      },
      scoring: {
        title: "Scoring & Tie-Breaks",
        icon: <lucide.Award size={20} />,
        rules: [
          "Marks per question and negative marking (if any) will be shown on the paper.",
          "Tie-breaks can use earliest finish time and/or accuracy in higher-weight sections.",
          "Disputed questions will be reviewed by the academic team; decisions are final.",
          "Leaderboards may refresh periodically; final results are published after validation.",
          "Any detected malpractice can nullify scores retroactively.",
        ],
      },
      prizes: {
        title: "Certificates & Prizes",
        icon: <lucide.Gift size={20} />,
        rules: [
          "Prizes/certificates are non-transferable and subject to verification.",
          "Taxes or compliance (if applicable) are the winner’s responsibility.",
          "Winners will be notified via their registered email/phone within the announced window.",
          "Claim your prize within 30 days of announcement unless the event specifies otherwise.",
          "Organizer decisions are final and binding.",
        ],
      },
      support: {
        title: "Help & Conduct",
        icon: <lucide.LifeBuoy size={20} />,
        rules: [
          "Contact support using the Help button/chat if you face technical issues.",
          "Be respectful in chats/forums. Abuse or harassment will lead to removal.",
          "Report suspicious activities; do not engage or share answers.",
          "Keep your profile info accurate for certificates and results.",
          "Follow all updates posted on the contest announcement page.",
        ],
      },
    }),
    []
  );

  const active = rulesData[activeSection as keyof RulesMapKey] || rulesData.eligibility;

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt" });
      const marginX = 48;
      let cursorY = 60;

      const line = (text: string, size = 11, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        const split = doc.splitTextToSize(text, 540);
        split.forEach((t: string) => {
          if (cursorY > 760) {
            doc.addPage();
            cursorY = 60;
          }
          doc.text(t, marginX, cursorY);
          cursorY += 18;
        });
      };

      // Header
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 72, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Contest Rules & Regulations", marginX, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`${contestType} Contest • Eligibility 12+`, marginX, 62);

      // Body
      doc.setTextColor(0, 0, 0);
      cursorY = 100;

      Object.values(rulesData).forEach((section) => {
        line(section.title, 14, true);
        section.rules.forEach((r, i) => line(`${i + 1}. ${r}`, 11, false));
        cursorY += 6;
        line(" ", 6);
      });

      const fileName = `Contest_Rules_${contestType.replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error(e);
      // Fallback: download a .txt if jsPDF isn’t available
      const all = [
        `Contest Rules & Regulations - ${contestType} (Eligibility 12+)`,
        "",
        ...Object.values(rulesData).flatMap((s) => [
          `## ${s.title}`,
          ...s.rules.map((r, i) => `${i + 1}. ${r}`),
          "",
        ]),
      ].join("\n");
      const blob = new Blob([all], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contest_Rules_${contestType.replace(/\s+/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const agreeAndClose = () => {
    if (!agree) return;
    onAgree?.();
    onClose?.();
  };

  return (
    <div className="contest-rules-container">
      <div className="rules-header">
        <div className="header-content">
          <div className="title-section">
            <lucide.FileText size={24} className="header-icon" />
            <div>
              <h1>Contest Rules & Regulations</h1>
              <p className="contest-type">
                {contestType} Contest • <strong>Eligibility 12+</strong>
              </p>
            </div>
          </div>
          {onClose && (
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <lucide.X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="rules-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <lucide.List size={18} />
            <span>Rules Categories</span>
          </div>
          <nav className="sidebar-nav">
            {Object.entries(rulesData).map(([key, section]) => (
              <button
                key={key}
                className={`nav-item ${activeSection === key ? "active" : ""}`}
                onClick={() => setActiveSection(key)}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-text">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="rules-details">
          <div className="section-header">
            <div className="section-title">
              {active.icon}
              <h2>{active.title}</h2>
            </div>
            <div className="section-badge">{active.rules.length} rules</div>
          </div>

          <div className="rules-list">
            {active.rules.map((rule, index) => (
              <div key={index} className="rule-item">
                <div className="rule-number">{index + 1}</div>
                <div className="rule-content">
                  <p>{rule}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rules-footer">
            <div className="agreement-section">
              <div className="agreement-header">
                <lucide.AlertCircle size={20} />
                <h3>Important Notice</h3>
              </div>
              <p>
                By participating, you agree to follow these rules and our honor
                code. Violations may lead to warnings, score nullification, or
                disqualification.
              </p>
              <label className="agree-check">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>I am 12+ and I understand & agree to all rules.</span>
              </label>
            </div>

            <div className="action-buttons">
              <button className="btn btn-secondary" onClick={downloadPdf}>
                <lucide.Download size={16} />
                Download Rules (PDF)
              </button>
              <button
                className={`btn btn-primary ${!agree ? "btn-disabled" : ""}`}
                onClick={agreeAndClose}
                disabled={!agree}
                title={!agree ? "Please agree to continue" : undefined}
              >
                <lucide.Check size={16} />
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .contest-rules-container {
          background: white;
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(2,6,23,.10);
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }
        .rules-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; padding: 22px 24px;
        }
        .header-content { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
        .title-section { display:flex; align-items:center; gap:14px; }
        .header-icon { opacity:.95; }
        .title-section h1 { font-size:22px; font-weight:800; line-height:1.2; margin:0; letter-spacing:.2px; }
        .contest-type { opacity:.95; margin:4px 0 0 0; font-size:13px; }
        .close-btn {
          background: rgba(255,255,255,.18); border:none; border-radius:10px;
          width:40px; height:40px; display:grid; place-items:center; color:white; cursor:pointer; transition:.2s;
        }
        .close-btn:hover { background: rgba(255,255,255,.28); transform: translateY(-1px); }

        .rules-content { display:flex; min-height: 620px; }
        .sidebar { width: 300px; background:#f8fafc; border-right:1px solid #e5e7eb; padding: 18px 0; }
        .sidebar-header { display:flex; align-items:center; gap:8px; padding: 0 20px 14px; font-weight:700; color:#374151; border-bottom:1px solid #e5e7eb; margin-bottom:12px; }
        .sidebar-nav { display:flex; flex-direction:column; gap:6px; padding: 0 12px; }
        .nav-item {
          display:flex; align-items:center; gap:12px; padding: 12px 14px;
          background: transparent; border-radius:10px; cursor:pointer; transition:.18s; color:#6b7280; border:none; text-align:left;
        }
        .nav-item:hover { background:#e5e7eb; color:#374151; transform: translateX(2px); }
        .nav-item.active { background:#3b82f6; color:white; }
        .nav-text { font-weight:600; font-size:14px; }

        .rules-details { flex:1; padding: 22px; display:flex; flex-direction:column; }
        .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid #e5e7eb; }
        .section-title { display:flex; align-items:center; gap:10px; }
        .section-title h2 { font-size:18px; font-weight:700; color:#111827; margin:0; }
        .section-badge { background:#eef2ff; color:#3730a3; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }

        .rules-list { flex:1; display:flex; flex-direction:column; gap:12px; margin-bottom:20px; }
        .rule-item {
          display:flex; gap:14px; padding:14px; background:#f8fafc; border-radius:10px; border-left:4px solid #3b82f6;
          box-shadow: 0 1px 0 rgba(2,6,23,.04);
        }
        .rule-number {
          background:#3b82f6; color:white; width:26px; height:26px; border-radius:50%;
          display:grid; place-items:center; font-size:13px; font-weight:800; flex-shrink:0;
        }
        .rule-content p { margin:0; color:#1f2937; line-height:1.55; font-size:14px; }

        .rules-footer { border-top:1px solid #e5e7eb; padding-top:18px; }
        .agreement-section {
          background:#fff7ed; border:1px solid #fdba74; border-radius:10px; padding:14px; margin-bottom:16px;
        }
        .agreement-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; color:#9a3412; }
        .agreement-header h3 { font-size:15px; font-weight:800; margin:0; }
        .agreement-section p { margin:0 0 10px; color:#9a3412; font-size:13px; }
        .agree-check { display:flex; align-items:center; gap:10px; font-size:13px; color:#7c2d12; }

        .action-buttons { display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap; }
        .btn {
          padding: 10px 16px; border-radius:10px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:.16s; border:none; font-size:14px;
          box-shadow: 0 8px 24px -10px rgba(2,6,23,.18);
        }
        .btn-primary { background: #3b82f6; color:white; }
        .btn-primary:hover { background:#2563eb; transform: translateY(-1px); }
        .btn-secondary { background:#f3f4f6; color:#111827; border:1px solid #e5e7eb; }
        .btn-secondary:hover { background:#e5e7eb; transform: translateY(-1px); }
        .btn-disabled { opacity:.6; cursor:not-allowed; transform:none !important; }

        @media (max-width: 900px) {
          .sidebar { width: 100%; border-right:none; border-bottom:1px solid #e5e7eb; }
          .rules-content { flex-direction:column; }
          .sidebar-nav { flex-direction: row; overflow-x:auto; padding: 0 12px 10px; }
          .nav-item { white-space: nowrap; }
          .action-buttons { justify-content:stretch; }
        }
      `}</style>
    </div>
  );
};

export default Rules;
