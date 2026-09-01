// src/components/student/StudentCalendar.tsx
// Student-facing calendar — shows batch events + assignment deadlines
// Import into StudentPortalPage for the Calendar sidebar tab

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

type CalEvent = {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  meeting_link?: string;
  color: string;
  is_assignment?: boolean;
};

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}); }

const TYPE_ICONS: Record<string,string> = {
  event:"📅", meeting:"📹", deadline:"⏰", holiday:"🎉", exam:"📝", class:"🏫"
};

export default function StudentCalendar({ batchId, instituteId }: { batchId: string; instituteId: string }) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent|null>(null);

  useEffect(() => { loadEvents(); }, [batchId]);

  useEffect(() => {
    if (!batchId) return;
    const ch = supabase
      .channel(`student-cal-${batchId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"calendar_events"}, () => loadEvents())
      .on("postgres_changes",{event:"*",schema:"public",table:"assignments"}, () => loadEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [batchId]);

  async function loadEvents() {
    const calEvents: CalEvent[] = [];

    // Calendar events for this batch or all-batch
    const { data: evts } = await supabase
      .from("calendar_events").select("*")
      .eq("institute_id", instituteId)
      .or(`batch_id.eq.${batchId},batch_id.is.null`)
      .order("start_time");

    if (evts) evts.forEach(e => calEvents.push(e));

    // Assignment deadlines
    const { data: asgns } = await supabase
      .from("assignments").select("id,title,deadline,max_marks")
      .eq("batch_id", batchId).eq("status","active").not("deadline","is",null);

    if (asgns) asgns.forEach(a => {
      if (a.deadline) calEvents.push({
        id:`asgn-${a.id}`, title:`📋 ${a.title}`,
        description:`Assignment deadline${a.max_marks?` · ${a.max_marks} marks`:""}`,
        event_type:"deadline", start_time:a.deadline, all_day:false,
        color:"#F59E0B", is_assignment:true,
      });
    });

    calEvents.sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime());
    setEvents(calEvents);
  }

  const monthGrid = useMemo(() => {
    const y=currentDate.getFullYear(), m=currentDate.getMonth();
    const first=new Date(y,m,1).getDay();
    const days=new Date(y,m+1,0).getDate();
    const prevDays=new Date(y,m,0).getDate();
    const cells:{date:Date;curr:boolean}[]=[];
    for(let i=first-1;i>=0;i--) cells.push({date:new Date(y,m-1,prevDays-i),curr:false});
    for(let i=1;i<=days;i++) cells.push({date:new Date(y,m,i),curr:true});
    const rem=42-cells.length;
    for(let i=1;i<=rem;i++) cells.push({date:new Date(y,m+1,i),curr:false});
    return cells;
  },[currentDate]);

  function getEventsForDay(d:Date) { return events.filter(e=>sameDay(new Date(e.start_time),d)); }

  const upcoming = events.filter(e => new Date(e.start_time) >= new Date(today.getFullYear(),today.getMonth(),today.getDate())).slice(0,10);

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", maxWidth: 800, margin: "0 auto" }}>
      <style>{`
        .sc-cell { min-height:70px; padding:4px; border:1px solid #F1F5F9; border-radius:6px; cursor:pointer; transition:background .1s; }
        .sc-cell:hover { background:#F8FAFC; }
        .sc-cell.today { background:#EEF2FF; border-color:#C7D2FE; }
        .sc-cell.other { opacity:.25; }
        .sc-dot { font-size:10px; font-weight:600; padding:1px 5px; border-radius:3px; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      `}</style>

      {/* Event detail modal */}
      {selectedEvent && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setSelectedEvent(null)}>
          <div style={{background:"#fff",borderRadius:20,padding:24,maxWidth:400,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:10,height:10,borderRadius:3,background:selectedEvent.color}}/>
              <h3 style={{margin:0,fontSize:16,fontWeight:800,color:"#1E293B",flex:1}}>{selectedEvent.title}</h3>
              <button onClick={()=>setSelectedEvent(null)} style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontWeight:700,color:"#64748B"}}>✕</button>
            </div>
            <p style={{margin:"0 0 6px",fontSize:13,color:"#475569"}}>📅 {new Date(selectedEvent.start_time).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</p>
            {!selectedEvent.all_day && <p style={{margin:"0 0 6px",fontSize:13,color:"#475569"}}>🕐 {fmtTime(selectedEvent.start_time)}{selectedEvent.end_time?` — ${fmtTime(selectedEvent.end_time)}`:""}</p>}
            {selectedEvent.meeting_link && (
              <a href={selectedEvent.meeting_link} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EEF2FF",color:"#4F46E5",padding:"8px 14px",borderRadius:10,fontWeight:700,fontSize:13,textDecoration:"none",margin:"8px 0"}}>📹 Join Meeting</a>
            )}
            {selectedEvent.description && <p style={{margin:"8px 0 0",fontSize:13,color:"#64748B",lineHeight:1.5}}>{selectedEvent.description}</p>}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{margin:0,fontSize:20,fontWeight:800,color:"#1E293B"}}>{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()-1,1))} style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700,color:"#64748B"}}>‹</button>
          <button onClick={()=>setCurrentDate(new Date())} style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700,fontSize:12,color:"#64748B"}}>Today</button>
          <button onClick={()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()+1,1))} style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700,color:"#64748B"}}>›</button>
        </div>
      </div>

      {/* Month grid */}
      <div style={{background:"#fff",borderRadius:16,padding:14,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {DAYS.map(d=><div key={d} style={{padding:"6px 0",textAlign:"center",fontSize:11,fontWeight:700,color:"#94A3B8"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {monthGrid.map((cell,i)=>{
            const dayEvts=getEventsForDay(cell.date);
            const isToday=sameDay(cell.date,today);
            return (
              <div key={i} className={`sc-cell ${isToday?"today":""} ${!cell.curr?"other":""}`}>
                <div style={{fontSize:12,fontWeight:isToday?800:600,color:isToday?"#4F46E5":"#1E293B",marginBottom:3,width:isToday?22:undefined,height:isToday?22:undefined,borderRadius:isToday?"50%":undefined,background:isToday?"#6366F1":undefined,color2:isToday?"#fff":undefined,display:isToday?"flex":undefined,alignItems:isToday?"center":undefined,justifyContent:isToday?"center":undefined,...(isToday?{color:"#fff"}:{})}}>
                  {cell.date.getDate()}
                </div>
                {dayEvts.slice(0,2).map(e=>(
                  <div key={e.id} className="sc-dot" style={{background:e.color+"20",color:e.color}} onClick={()=>setSelectedEvent(e)}>
                    {e.title.length>12?e.title.slice(0,12)+"…":e.title}
                  </div>
                ))}
                {dayEvts.length>2 && <div style={{fontSize:9,color:"#94A3B8",fontWeight:700}}>+{dayEvts.length-2}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming */}
      <div style={{background:"#fff",borderRadius:16,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:800,color:"#1E293B"}}>📅 Upcoming</h4>
        {upcoming.length===0 ? (
          <p style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:"16px 0"}}>No upcoming events</p>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {upcoming.map(e=>(
              <div key={e.id} onClick={()=>setSelectedEvent(e)}
                style={{padding:"10px 14px",borderRadius:12,borderLeft:`4px solid ${e.color}`,background:"#FAFBFC",cursor:"pointer",transition:"all .15s"}}
                onMouseEnter={ev=>(ev.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)")}
                onMouseLeave={ev=>(ev.currentTarget.style.boxShadow="none")}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:"#1E293B"}}>
                    {TYPE_ICONS[e.event_type]||"📅"} {e.title}
                  </p>
                  {e.meeting_link && <span style={{fontSize:11,color:"#4F46E5",fontWeight:700}}>📹 Link</span>}
                </div>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#94A3B8"}}>
                  {new Date(e.start_time).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
                  {!e.all_day && ` · ${fmtTime(e.start_time)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}