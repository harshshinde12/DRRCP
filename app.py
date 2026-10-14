"""
DRRCP — Disaster Relief & Rescue Coordination Platform
A full-stack disaster management operations portal deployed on Streamlit.
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import pydeck as pdk
import datetime
import db

# Page Configuration
st.set_page_config(
    page_title="DRRCP — Disaster Relief & Rescue Coordination Platform",
    page_icon="🚨",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling for polished dashboard look
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1rem;
        color: #64748B;
        margin-bottom: 1.5rem;
    }
    .badge-critical {
        background-color: #FEE2E2;
        color: #991B1B;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .badge-high {
        background-color: #FFEDD5;
        color: #9A3412;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .badge-medium {
        background-color: #FEF3C7;
        color: #92400E;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .badge-low {
        background-color: #DCFCE7;
        color: #166534;
        padding: 4px 10px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .metric-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
</style>
""", unsafe_allow_html=True)

# Fetch platform overview
summary = db.get_disaster_summary()
disaster_name = summary['disaster']['name'] if summary['disaster'] else "Active Disaster Simulation"

# Top Banner
col_head1, col_head2 = st.columns([3, 1])
with col_head1:
    st.markdown('<div class="main-header">🚨 DRRCP Coordination Platform</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="sub-header">Active Incident: <b>{disaster_name}</b> • Live Emergency & Relief Operations Command</div>', unsafe_allow_html=True)
with col_head2:
    st.info("🟢 System Operational • Live Sync Enabled")

# Sidebar Navigation
st.sidebar.image("https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=400&q=80", use_container_width=True)
st.sidebar.title("Navigation Portals")
portal = st.sidebar.radio(
    "Select Portal / View",
    [
        "📊 Admin Command Center",
        "🚨 Citizen SOS & Tracking",
        "🗺️ Live Crisis GIS Map",
        "🚤 Rescue Squad Operations",
        "🏕️ Relief Shelters & Capacity",
        "📦 NGO Inventory & Supplies",
        "📋 Audit Log & Traceability"
    ]
)

st.sidebar.markdown("---")
st.sidebar.markdown("""
**Quick Helplines:**
- 🚨 Emergency Police/Rescue: **112**
- 🌊 Disaster Management: **1078**
- 🚑 Emergency Ambulance: **102**
""")

# ==============================================================================
# 1. ADMIN COMMAND CENTER
# ==============================================================================
if portal == "📊 Admin Command Center":
    st.subheader("📊 Central Command Center & Operational Metrics")
    
    # KPIs
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Total Incident Requests", summary['total_requests'], delta="Live queue")
    k2.metric("Critical SOS Needs", summary['critical_requests'], delta="High priority", delta_color="inverse")
    k3.metric("Citizens Rescued", summary['people_rescued'], delta="Safely evacuated")
    k4.metric("Available Shelter Beds", summary['available_beds'], delta=f"{summary['open_shelters']} open shelters")
    
    st.markdown("---")

    col_chart1, col_chart2 = st.columns(2)
    reqs_df = db.get_requests()
    
    with col_chart1:
        st.markdown("##### 📌 Incident Breakdown by Type")
        if not reqs_df.empty:
            type_counts = reqs_df['emergencyType'].value_counts().reset_index()
            type_counts.columns = ['Type', 'Count']
            fig_type = px.pie(type_counts, values='Count', names='Type', hole=0.4,
                              color_discrete_sequence=px.colors.qualitative.Safe)
            fig_type.update_layout(margin=dict(t=10, b=10, l=10, r=10), height=280)
            st.plotly_chart(fig_type, use_container_width=True)
        else:
            st.write("No requests found.")

    with col_chart2:
        st.markdown("##### ⚡ Incident Priority Distribution")
        if not reqs_df.empty:
            prio_counts = reqs_df['priority'].value_counts().reset_index()
            prio_counts.columns = ['Priority', 'Count']
            color_map = {'CRITICAL': '#EF4444', 'HIGH': '#F97316', 'MEDIUM': '#F59E0B', 'LOW': '#10B981'}
            fig_prio = px.bar(prio_counts, x='Priority', y='Count', color='Priority',
                              color_discrete_map=color_map)
            fig_prio.update_layout(margin=dict(t=10, b=10, l=10, r=10), height=280, showlegend=False)
            st.plotly_chart(fig_prio, use_container_width=True)

    st.markdown("### 📋 Incident Triage Queue & Dispatch")
    filter_col1, filter_col2 = st.columns([1, 1])
    with filter_col1:
        status_sel = st.selectbox("Filter by Status", ["ALL", "SUBMITTED", "VERIFIED", "ASSIGNED", "RESCUE_IN_PROGRESS", "RESOLVED", "DUPLICATE"])
    with filter_col2:
        prio_sel = st.selectbox("Filter by Priority", ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"])

    filtered_reqs = db.get_requests(status_filter=status_sel, priority_filter=prio_sel)
    
    if filtered_reqs.empty:
        st.info("No emergency requests match the current filters.")
    else:
        for idx, row in filtered_reqs.iterrows():
            with st.expander(f"🚨 [{row['priority']}] {row['emergencyType']} - {row['location']} ({row['status']})"):
                c1, c2 = st.columns([2, 1])
                with c1:
                    st.write(f"**Description:** {row['description']}")
                    st.write(f"**People Affected:** {row['peopleAffected']} | **Injuries Present:** {'Yes - ' + str(row.get('injurySeverity', '')) if row['injuryPresent'] else 'No'}")
                    st.write(f"**Reported At:** {row['createdAt']}")
                    if row.get('assignedTeamName'):
                        st.write(f"**Dispatched Unit:** 🚤 `{row['assignedTeamName']}` (Mission Status: *{row.get('missionStatus', 'ASSIGNED')}*)")
                
                with c2:
                    st.markdown("##### Action Control")
                    if row['status'] == 'SUBMITTED':
                        col_act1, col_act2 = st.columns(2)
                        with col_act1:
                            new_prio = st.selectbox("Assign Priority", ["CRITICAL", "HIGH", "MEDIUM", "LOW"], key=f"prio_{row['id']}")
                        with col_act2:
                            if st.button("✅ Verify Request", key=f"btn_ver_{row['id']}"):
                                db.verify_and_prioritize(row['id'], "VERIFIED", new_prio)
                                st.success("Request verified and prioritized!")
                                st.rerun()
                        
                        if st.button("❌ Mark Duplicate", key=f"btn_dup_{row['id']}"):
                            db.verify_and_prioritize(row['id'], "DUPLICATE", "LOW")
                            st.warning("Marked as duplicate.")
                            st.rerun()

                    elif row['status'] == 'VERIFIED':
                        teams_df = db.get_teams()
                        avail_teams = teams_df[teams_df['availabilityStatus'] == 'AVAILABLE']
                        if not avail_teams.empty:
                            team_choice = st.selectbox("Select Available Unit", avail_teams['name'].tolist(), key=f"t_sel_{row['id']}")
                            if st.button("🚤 Dispatch Team", key=f"btn_dsp_{row['id']}"):
                                chosen_id = avail_teams[avail_teams['name'] == team_choice]['id'].values[0]
                                db.assign_rescue_team(row['id'], chosen_id)
                                st.success(f"Dispatched {team_choice} to incident!")
                                st.rerun()
                        else:
                            st.warning("All rescue squads are currently engaged.")
                    elif row['status'] == 'RESOLVED':
                        st.success("Incident safely resolved & field report archived.")

# ==============================================================================
# 2. CITIZEN SOS & TRACKING PORTAL
# ==============================================================================
elif portal == "🚨 Citizen SOS & Tracking":
    st.subheader("🚨 Citizen Emergency Help Request (SOS)")
    st.write("Submit urgent relief requests for stranded citizens, medical emergencies, or critical food/water shortages.")

    sos_tab1, sos_tab2 = st.tabs(["📝 Submit Emergency Request", "🔍 Track Existing Request"])
    
    with sos_tab1:
        with st.form("emergency_sos_form", clear_on_submit=True):
            col_f1, col_f2 = st.columns(2)
            with col_f1:
                e_type = st.selectbox("Emergency Category", ["RESCUE", "MEDICAL", "FOOD", "WATER", "SHELTER", "INFRASTRUCTURE"])
                people_count = st.number_input("Number of People Affected/Trapped", min_value=1, max_value=200, value=3)
                injured_chk = st.checkbox("Anyone Injured or Requiring Urgent Medical Care?")
                severity = st.selectbox("Injury Severity", ["NONE", "MINOR", "MODERATE", "SEVERE"], index=1 if injured_chk else 0)

            with col_f2:
                loc_text = st.text_input("Exact Landmark / Building / Address", "Flat 402, Shivam Apts, SV Road, Andheri West")
                col_gps1, col_gps2 = st.columns(2)
                with col_gps1:
                    lat_in = st.number_input("Latitude (approx)", value=19.1362, format="%.4f")
                with col_gps2:
                    lng_in = st.number_input("Longitude (approx)", value=72.8272, format="%.4f")
                
                desc_text = st.text_area("Situation Details & Specific Hazards", "Ground floor completely flooded, elderly residents trapped without electricity.")

            submitted = st.form_submit_button("🚨 Confirm & Submit Emergency SOS", use_container_width=True)
            if submitted:
                # Auto-calculate suggested priority based on injuries & count
                calc_prio = "CRITICAL" if (injured_chk and severity in ["SEVERE", "MODERATE"]) or people_count > 10 else "HIGH"
                new_id = db.submit_emergency_request(e_type, desc_text, loc_text, lat_in, lng_in, people_count, injured_chk, severity, calc_prio)
                st.success(f"Emergency request submitted successfully! Your Request Tracking ID is: **{new_id}**")
                st.info("Our emergency dispatch command center has received your request. Verification is underway.")

    with sos_tab2:
        st.markdown("#### Track Request Status")
        search_id = st.text_input("Enter Request ID (leave empty to view recent requests):")
        all_reqs = db.get_requests()
        
        if search_id:
            matched = all_reqs[all_reqs['id'].str.contains(search_id.strip(), case=False, na=False)]
        else:
            matched = all_reqs.head(5)

        for _, r in matched.iterrows():
            st.markdown(f"### Incident: `{r['id'][:8]}...` — {r['emergencyType']} ({r['location']})")
            
            # Progress steps
            steps = ["SUBMITTED", "VERIFIED", "ASSIGNED", "RESCUE_IN_PROGRESS", "RESOLVED"]
            cur_status = r['status']
            cur_idx = steps.index(cur_status) if cur_status in steps else 0
            
            col_p = st.columns(5)
            for idx, step_name in enumerate(steps):
                with col_p[idx]:
                    if idx <= cur_idx:
                        st.success(f"✅ {step_name.replace('_', ' ')}")
                    else:
                        st.caption(f"⚪ {step_name.replace('_', ' ')}")
            
            st.write(f"**Current Status:** `{r['status']}` | **Priority:** `{r['priority']}`")
            st.write(f"**Details:** {r['description']}")
            st.markdown("---")

# ==============================================================================
# 3. LIVE CRISIS GIS MAP
# ==============================================================================
elif portal == "🗺️ Live Crisis GIS Map":
    st.subheader("🗺️ Live Crisis Operations Map — Mumbai Floods 2026")
    st.write("Real-time geographic visualization of emergency distress calls, relief shelters, and active rescue squads.")

    reqs = db.get_requests()
    shelters = db.get_shelters()
    teams = db.get_teams()

    # Build Map Data
    map_incidents = reqs.dropna(subset=['latitude', 'longitude']).copy()
    
    # Priority Color mapping (RGBA)
    def get_color(prio):
        if prio == "CRITICAL":
            return [239, 68, 68, 200]
        elif prio == "HIGH":
            return [249, 115, 22, 200]
        elif prio == "MEDIUM":
            return [245, 158, 11, 200]
        return [16, 185, 129, 200]

    if not map_incidents.empty:
        map_incidents['color'] = map_incidents['priority'].apply(get_color)

    # Pydeck Layers
    layers = []

    if not map_incidents.empty:
        incident_layer = pdk.Layer(
            "ScatterplotLayer",
            data=map_incidents,
            get_position='[longitude, latitude]',
            get_color='color',
            get_radius=250,
            pickable=True,
            auto_highlight=True,
        )
        layers.append(incident_layer)

    if not shelters.empty:
        shelter_map = shelters.dropna(subset=['latitude', 'longitude']).copy()
        shelter_layer = pdk.Layer(
            "ColumnLayer",
            data=shelter_map,
            get_position='[longitude, latitude]',
            get_elevation='currentOccupancy',
            elevation_scale=2,
            radius=150,
            get_fill_color=[59, 130, 246, 220],
            pickable=True,
            auto_highlight=True,
        )
        layers.append(shelter_layer)

    view_state = pdk.ViewState(
        latitude=19.0800,
        longitude=72.8550,
        zoom=11,
        pitch=40,
    )

    r = pdk.Deck(
        layers=layers,
        initial_view_state=view_state,
        tooltip={"text": "Incident / Facility: {location}\nDetails: {description}\nStatus: {status}"},
        map_style="mapbox://styles/mapbox/light-v9"
    )
    
    st.pydeck_chart(r)

    # Map Legend
    st.markdown("""
    **Map Indicators:**
    - 🔴 **Red Pin:** Critical SOS (trapped citizens / life threat)
    - 🟠 **Orange Pin:** High Priority Incident
    - 🟡 **Yellow Pin:** Medium Priority Incident
    - 🔵 **Blue Column:** Relief Shelter (height represents current occupancy)
    """)

# ==============================================================================
# 4. RESCUE SQUAD OPERATIONS
# ==============================================================================
elif portal == "🚤 Rescue Squad Operations":
    st.subheader("🚤 Rescue Squad Missions & Field Execution")
    
    teams = db.get_teams()
    team_selected = st.selectbox("Select Active Squad", teams['name'].tolist())
    team_data = teams[teams['name'] == team_selected].iloc[0]

    t_col1, t_col2, t_col3 = st.columns(3)
    t_col1.metric("Squad Capability", team_data['capability'])
    t_col2.metric("Personnel Count", f"{team_data['memberCount']} Members")
    t_col3.metric("Deployment Status", team_data['availabilityStatus'])

    st.markdown("---")
    st.markdown(f"#### Active Dispatches for {team_selected}")
    
    all_reqs = db.get_requests()
    team_reqs = all_reqs[all_reqs['assignedTeamName'] == team_selected]
    
    if team_reqs.empty:
        st.success(f"{team_selected} currently has no active missions assigned. Squad on standby.")
    else:
        for _, req in team_reqs.iterrows():
            with st.card() if hasattr(st, 'card') else st.container():
                st.markdown(f"### 🎯 Incident: {req['emergencyType']} at {req['location']}")
                st.write(f"**Citizens in Distress:** {req['peopleAffected']} | **Injuries:** {'Yes' if req['injuryPresent'] else 'None reported'}")
                st.write(f"**Notes:** {req['description']}")
                
                m_stat = req.get('missionStatus', 'ASSIGNED')
                st.info(f"Current Mission Progress: **{m_stat}**")

                col_b1, col_b2, col_b3 = st.columns(3)
                if col_b1.button("🚨 En Route / On The Way", key=f"otw_{req['id']}"):
                    db.verify_and_prioritize(req['id'], "RESCUE_IN_PROGRESS", req['priority'])
                    st.success("Status updated: Squad is en route.")
                    st.rerun()

                with st.expander("📝 Complete Mission & File Rescue Report"):
                    with st.form(f"report_form_{req['id']}"):
                        rescued = st.number_input("Number of Persons Rescued", min_value=0, value=req['peopleAffected'])
                        treated = st.number_input("Injured Persons Treated / Hospitalized", min_value=0, value=0)
                        notes = st.text_area("Field Operation Log", "Citizens safely evacuated to local shelter.")
                        if st.form_submit_button("Submit Rescue Report & Conclude Incident"):
                            db.verify_and_prioritize(req['id'], "RESOLVED", "LOW")
                            st.success("Mission completed and rescue report archived!")
                            st.rerun()

# ==============================================================================
# 5. RELIEF SHELTERS & CAPACITY
# ==============================================================================
elif portal == "🏕️ Relief Shelters & Capacity":
    st.subheader("🏕️ Relief Shelters & Bed Capacity Management")
    
    shelters = db.get_shelters()
    
    for _, sh in shelters.iterrows():
        occ = sh['currentOccupancy']
        tot = sh['totalCapacity']
        avail = sh['availableBeds']
        pct = int((occ / tot) * 100) if tot > 0 else 0
        
        with st.container():
            c1, c2, c3 = st.columns([2, 2, 1])
            with c1:
                st.markdown(f"### {sh['name']}")
                st.write(f"📍 **Location:** {sh['location']} | **Status:** `{sh['operatingStatus']}`")
                st.write(f"🏷️ **Amenities:** {sh['facilities']}")
            
            with c2:
                st.write(f"**Bed Occupancy:** {occ} / {tot} ({pct}%)")
                st.progress(min(pct / 100.0, 1.0))
                st.write(f"🛏️ **Available Beds:** **{avail}**")
            
            with c3:
                st.markdown("**Quick Capacity Update:**")
                b_in, b_out = st.columns(2)
                if b_in.button("➕ Check In (+5)", key=f"cin_{sh['id']}"):
                    db.update_shelter_occupancy(sh['id'], 5)
                    st.rerun()
                if b_out.button("➖ Check Out (-5)", key=f"cout_{sh['id']}"):
                    db.update_shelter_occupancy(sh['id'], -5)
                    st.rerun()
            st.markdown("---")

# ==============================================================================
# 6. NGO INVENTORY & SUPPLIES
# ==============================================================================
elif portal == "📦 NGO Inventory & Supplies":
    st.subheader("📦 NGO Relief Inventory & Resource Distribution")
    
    tab_inv, tab_reqs = st.tabs(["Warehouse Stock", "Shelter Resource Requests"])
    
    with tab_inv:
        st.markdown("#### Central Warehouse Stock")
        inv_df = db.get_inventory()
        st.dataframe(inv_df[['itemName', 'category', 'quantityAvailable', 'unit', 'location', 'organization']], use_container_width=True)

    with tab_reqs:
        st.markdown("#### Pending Shelter Resource Requisitions")
        r_reqs = db.get_resource_requests()
        if r_reqs.empty:
            st.info("No active resource requisitions at this time.")
        else:
            for _, r in r_reqs.iterrows():
                with st.expander(f"📦 Requisition: {r['quantityRequired']} {r['unit']} of {r['itemName']} for {r['shelterName']} ({r['status']})"):
                    st.write(f"**Priority:** `{r['priority']}` | **Fulfilled so far:** {r['quantityFulfilled']} {r['unit']}")
                    if r['status'] != 'FULFILLED':
                        if st.button("🚀 Authorize & Dispatch Allocation", key=f"alloc_{r['id']}"):
                            success = db.allocate_inventory(r['id'], r['itemName'], r['quantityRequired'])
                            if success:
                                st.success("Stock allocated and marked in transit!")
                                st.rerun()
                            else:
                                st.error("Insufficient stock in warehouse to fulfill this request.")

# ==============================================================================
# 7. AUDIT LOG & TRACEABILITY
# ==============================================================================
elif portal == "📋 Audit Log & Traceability":
    st.subheader("📋 System Audit Log & Decision Traceability")
    st.write("Immutable event log recording triage decisions, team dispatches, and inventory allocations.")
    
    audit_df = db.get_audit_logs()
    st.dataframe(audit_df[['createdAt', 'actorId', 'action', 'target', 'targetId', 'metadata']], use_container_width=True)

# Footer
st.markdown("---")
st.markdown(
    """
    <div style="text-align: center; color: #94A3B8; font-size: 0.85rem;">
        DRRCP (Disaster Relief & Rescue Coordination Platform) • Academic Software Engineering Project Release 1.0<br/>
        GitHub: <a href="https://github.com/harshshinde12/DRRCP" target="_blank">harshshinde12/DRRCP</a> • REST API Docs: <code>/api/docs</code>
    </div>
    """,
    unsafe_allow_html=True
)
