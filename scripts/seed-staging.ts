/**
 * Staging Seed Script
 * -------------------
 * Populates the staging database with realistic fake data.
 * Run with: npx tsx scripts/seed-staging.ts
 *
 * WARNING: This script CLEARS existing data before seeding.
 * Only run against the staging database — never production.
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Safety check — refuse to run against a URL that looks like production
const dbUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV === "production") {
  console.error("❌  Refusing to seed: NODE_ENV is 'production'. Staging only.");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool, { schema });

const hash = (pw: string) => bcrypt.hash(pw, 10);

// ─── IDs ────────────────────────────────────────────────────────────────────

// Companies
const CO1 = "seed-co-hartwell-001";
const CO2 = "seed-co-meridian-002";
const CO3 = "seed-co-apex-003";

// Sites
const S1A = "seed-site-hartwell-hq";
const S1B = "seed-site-hartwell-north";
const S2A = "seed-site-meridian-hq";
const S2B = "seed-site-meridian-south";
const S3A = "seed-site-apex-central";
const S3B = "seed-site-apex-west";

// Users — consultants & admin
const U_ADMIN   = "seed-user-admin-001";
const U_CON1    = "seed-user-con-james";
const U_CON2    = "seed-user-con-sarah";

// Users — clients (2 per company)
const U_CLI1A   = "seed-user-cli-hartwell-a";
const U_CLI1B   = "seed-user-cli-hartwell-b";
const U_CLI2A   = "seed-user-cli-meridian-a";
const U_CLI2B   = "seed-user-cli-meridian-b";
const U_CLI3A   = "seed-user-cli-apex-a";
const U_CLI3B   = "seed-user-cli-apex-b";

async function clearData(client: pg.PoolClient) {
  console.log("🗑  Clearing existing seed data…");

  // Delete in dependency order (children first)
  const tables = [
    "support_messages", "support_requests",
    "training_bookings", "training_requests", "training_courses", "training_folders",
    "incident_milestones", "incidents",
    "case_notes", "case_milestones", "case_document_checklist", "cases",
    "document_versions", "documents",
    "client_site_assignments", "consultant_assignments",
    "site_module_access", "sites",
    "users",
    "companies",
  ];

  for (const table of tables) {
    await client.query(
      `DELETE FROM ${table} WHERE id LIKE 'seed-%' OR id IN (
        SELECT id FROM ${table}
        WHERE id LIKE 'seed-%'
      )` 
    ).catch(() => {/* table may not have seed rows, ignore */});
  }

  // Targeted deletes using our known seed IDs
  const companyIds = [CO1, CO2, CO3];
  const siteIds    = [S1A, S1B, S2A, S2B, S3A, S3B];
  const userIds    = [U_ADMIN, U_CON1, U_CON2, U_CLI1A, U_CLI1B, U_CLI2A, U_CLI2B, U_CLI3A, U_CLI3B];

  for (const id of userIds) {
    await client.query("DELETE FROM support_messages WHERE sender_id = $1", [id]).catch(() => {});
    await client.query("DELETE FROM support_requests WHERE created_by = $1", [id]).catch(() => {});
    await client.query("DELETE FROM training_bookings WHERE booked_by = $1", [id]).catch(() => {});
    await client.query("DELETE FROM client_site_assignments WHERE client_id = $1", [id]).catch(() => {});
    await client.query("DELETE FROM consultant_assignments WHERE consultant_id = $1", [id]).catch(() => {});
    await client.query("DELETE FROM document_versions WHERE uploaded_by = $1", [id]).catch(() => {});
    await client.query("DELETE FROM documents WHERE uploaded_by = $1", [id]).catch(() => {});
    await client.query("DELETE FROM incidents WHERE reported_by = $1", [id]).catch(() => {});
    await client.query("DELETE FROM cases WHERE created_by = $1", [id]).catch(() => {});
    await client.query("DELETE FROM users WHERE id = $1", [id]).catch(() => {});
  }

  for (const id of siteIds) {
    await client.query("DELETE FROM site_module_access WHERE site_id = $1", [id]).catch(() => {});
    await client.query("DELETE FROM sites WHERE id = $1", [id]).catch(() => {});
  }

  for (const id of companyIds) {
    await client.query("DELETE FROM companies WHERE id = $1", [id]).catch(() => {});
  }

  console.log("✅  Clear complete.");
}

async function seed() {
  const client = await pool.connect();
  try {
    await clearData(client);

    // ── 1. COMPANIES ──────────────────────────────────────────────────────────
    console.log("🏢  Seeding companies…");

    await client.query(`
      INSERT INTO companies (id, reference_number, name, address_line1, city, county, postal_code, country,
        contact_name, contact_email, contact_phone, status,
        health_safety_access, employment_law_access, training_access, toolkit_access, support_access)
      VALUES
        ($1,'CON-STAG-001','Hartwell Construction Ltd','12 Builder Way','Manchester','Greater Manchester','M1 2AB','United Kingdom',
         'David Hartwell','d.hartwell@hartwell.co.uk','01612001001','active',true,true,true,true,true),
        ($2,'CON-STAG-002','Meridian Logistics Ltd','45 Fleet Road','Birmingham','West Midlands','B2 4CD','United Kingdom',
         'Claire Medway','c.medway@meridianlog.co.uk','01213001002','active',true,false,true,true,true),
        ($3,'CON-STAG-003','Apex Retail Group Ltd','99 High Street','London','Greater London','EC1A 1BB','United Kingdom',
         'Tom Apex','t.apex@apexretail.co.uk','02030001003','active',true,true,false,false,true)
    `, [CO1, CO2, CO3]);

    // ── 2. SITES ──────────────────────────────────────────────────────────────
    console.log("📍  Seeding sites…");

    await client.query(`
      INSERT INTO sites (id, reference_number, entity_id, name, address_line1, city, postal_code, country,
        contact_name, contact_email)
      VALUES
        ($1,'STE-STAG-001',$7,'Head Office','12 Builder Way','Manchester','M1 2AB','United Kingdom','David Hartwell','d.hartwell@hartwell.co.uk'),
        ($2,'STE-STAG-002',$7,'Northern Depot','88 North Lane','Leeds','LS1 3FG','United Kingdom','Phil Stone','p.stone@hartwell.co.uk'),
        ($3,'STE-STAG-003',$8,'Meridian HQ','45 Fleet Road','Birmingham','B2 4CD','United Kingdom','Claire Medway','c.medway@meridianlog.co.uk'),
        ($4,'STE-STAG-004',$8,'Southern Hub','22 South Park','Bristol','BS1 5HJ','United Kingdom','Mark Lowe','m.lowe@meridianlog.co.uk'),
        ($5,'STE-STAG-005',$9,'Central Store','99 High Street','London','EC1A 1BB','United Kingdom','Tom Apex','t.apex@apexretail.co.uk'),
        ($6,'STE-STAG-006',$9,'West Branch','14 West End Ave','London','W1A 2CD','United Kingdom','Lucy West','l.west@apexretail.co.uk')
    `, [S1A, S1B, S2A, S2B, S3A, S3B, CO1, CO2, CO3]);

    // ── 3. USERS ──────────────────────────────────────────────────────────────
    console.log("👤  Seeding users…");

    const adminPw  = await hash("Staging123!");
    const conPw    = await hash("Staging123!");
    const clientPw = await hash("Staging123!");

    await client.query(`
      INSERT INTO users (id, reference_number, username, password, email, full_name, first_name, last_name, role, status, consultant_tier)
      VALUES
        ($1,'USR-STAG-001','admin@staging.guardian.com',$10,'admin@staging.guardian.com','Guardian Admin','Guardian','Admin','administrator','active',NULL),
        ($2,'USR-STAG-002','james.wright@guardian.com',$11,'james.wright@guardian.com','James Wright','James','Wright','consultant','active','pro'),
        ($3,'USR-STAG-003','sarah.hayes@guardian.com',$11,'sarah.hayes@guardian.com','Sarah Hayes','Sarah','Hayes','consultant','active','standard'),
        ($4,'USR-STAG-004','david.hartwell@hartwell.co.uk',$12,'david.hartwell@hartwell.co.uk','David Hartwell','David','Hartwell','client','active',NULL),
        ($5,'USR-STAG-005','phil.stone@hartwell.co.uk',$12,'phil.stone@hartwell.co.uk','Phil Stone','Phil','Stone','client','active',NULL),
        ($6,'USR-STAG-006','claire.medway@meridianlog.co.uk',$12,'claire.medway@meridianlog.co.uk','Claire Medway','Claire','Medway','client','active',NULL),
        ($7,'USR-STAG-007','mark.lowe@meridianlog.co.uk',$12,'mark.lowe@meridianlog.co.uk','Mark Lowe','Mark','Lowe','client','active',NULL),
        ($8,'USR-STAG-008','tom.apex@apexretail.co.uk',$12,'tom.apex@apexretail.co.uk','Tom Apex','Tom','Apex','client','active',NULL),
        ($9,'USR-STAG-009','lucy.west@apexretail.co.uk',$12,'lucy.west@apexretail.co.uk','Lucy West','Lucy','West','client','active',NULL)
    `, [U_ADMIN, U_CON1, U_CON2, U_CLI1A, U_CLI1B, U_CLI2A, U_CLI2B, U_CLI3A, U_CLI3B, adminPw, conPw, clientPw]);

    // Set company IDs for client users
    await client.query(`UPDATE users SET entity_id = $1 WHERE id IN ($2,$3)`, [CO1, U_CLI1A, U_CLI1B]);
    await client.query(`UPDATE users SET entity_id = $1 WHERE id IN ($2,$3)`, [CO2, U_CLI2A, U_CLI2B]);
    await client.query(`UPDATE users SET entity_id = $1 WHERE id IN ($2,$3)`, [CO3, U_CLI3A, U_CLI3B]);

    // Set primary contacts on companies
    await client.query(`UPDATE companies SET contact_user_id = $1 WHERE id = $2`, [U_CLI1A, CO1]);
    await client.query(`UPDATE companies SET contact_user_id = $1 WHERE id = $2`, [U_CLI2A, CO2]);
    await client.query(`UPDATE companies SET contact_user_id = $1 WHERE id = $2`, [U_CLI3A, CO3]);

    // ── 4. CONSULTANT ASSIGNMENTS ─────────────────────────────────────────────
    console.log("🔗  Seeding assignments…");

    // James Wright covers Hartwell & Meridian (primary on both HQs)
    // Sarah Hayes covers Apex + Meridian South
    await client.query(`
      INSERT INTO consultant_assignments (id, consultant_id, entity_id, site_id, is_primary, can_manage_modules)
      VALUES
        (gen_random_uuid(),$1,$3,$3,true,true),
        (gen_random_uuid(),$1,$4,$4,false,false),
        (gen_random_uuid(),$1,$5,$5,true,true),
        (gen_random_uuid(),$1,$6,$6,false,false),
        (gen_random_uuid(),$2,$7,$7,true,true),
        (gen_random_uuid(),$2,$8,$8,false,false),
        (gen_random_uuid(),$2,$6,$6,false,false)
    `, [U_CON1, U_CON2, S1A, S1B, S2A, S2B, S3A, S3B]);

    // ── 5. CLIENT SITE ASSIGNMENTS ────────────────────────────────────────────
    await client.query(`
      INSERT INTO client_site_assignments (id, client_id, site_id)
      VALUES
        (gen_random_uuid(),$1,$5),
        (gen_random_uuid(),$1,$6),
        (gen_random_uuid(),$2,$6),
        (gen_random_uuid(),$3,$7),
        (gen_random_uuid(),$3,$8),
        (gen_random_uuid(),$4,$8),
        (gen_random_uuid(),$9,$10),
        (gen_random_uuid(),$9,$11),
        (gen_random_uuid(),$12,$11)
    `, [U_CLI1A, U_CLI1B, U_CLI2A, U_CLI2B, U_CLI3A, U_CLI3B, S1A, S1B, S2A, S2B, S3A, S3B]);

    // ── 6. SITE MODULE ACCESS ─────────────────────────────────────────────────
    console.log("⚙️   Seeding site module access…");

    const modules = ["health_safety", "employment_law", "human_resources", "training", "toolkit"];
    for (const siteId of [S1A, S1B, S2A, S2B, S3A, S3B]) {
      for (const mod of modules) {
        await client.query(`
          INSERT INTO site_module_access (id, site_id, module, status, granted_by, granted_at)
          VALUES (gen_random_uuid(), $1, $2, 'active', $3, NOW())
          ON CONFLICT DO NOTHING
        `, [siteId, mod, U_ADMIN]);
      }
    }

    // ── 7. DOCUMENTS ──────────────────────────────────────────────────────────
    console.log("📄  Seeding documents…");

    const now = new Date();
    const future = new Date(now.getTime() + 180 * 86400000);
    const past   = new Date(now.getTime() - 30 * 86400000);
    const overdue = new Date(now.getTime() - 10 * 86400000);

    await client.query(`
      INSERT INTO documents (id, title, module, type, entity_id, site_id, file_name, file_url, file_size, mime_type,
        status, approval_status, uploaded_by, is_mandatory, scope, renewal_date, expiry_date, is_archived)
      VALUES
        (gen_random_uuid(),'Fire Risk Assessment 2025','health_safety','policy',$1,$7,'fire-risk-2025.pdf',NULL,204800,'application/pdf',
         'compliant','approved',$3,true,'site',$9,NULL,false),
        (gen_random_uuid(),'COSHH Assessment','health_safety','risk_assessment',$1,$7,'coshh.pdf',NULL,153600,'application/pdf',
         'approval_required','pending',$3,true,'site',NULL,NULL,false),
        (gen_random_uuid(),'Manual Handling Policy','health_safety','policy',$1,$8,'manual-handling.pdf',NULL,102400,'application/pdf',
         'overdue','pending',$3,true,'site',$10,NULL,false),
        (gen_random_uuid(),'Driver Safety Procedure','health_safety','procedure',$2,$5,'driver-safety.pdf',NULL,81920,'application/pdf',
         'compliant','approved',$3,false,'site',$9,NULL,false),
        (gen_random_uuid(),'Lone Worker Policy','health_safety','policy',$2,$5,'lone-worker.pdf',NULL,61440,'application/pdf',
         'approval_required','client_signed_off',$4,true,'site',NULL,NULL,false),
        (gen_random_uuid(),'Grievance Procedure','employment_law','policy',$1,$7,'grievance.pdf',NULL,92160,'application/pdf',
         'compliant','approved',$3,false,'site',$9,NULL,false),
        (gen_random_uuid(),'Disciplinary Policy','employment_law','policy',$3,$11,'disciplinary.pdf',NULL,71680,'application/pdf',
         'approval_required','changes_requested',$4,true,'site',NULL,NULL,false),
        (gen_random_uuid(),'PPE Register','health_safety','register',$1,$8,'ppe-register.pdf',NULL,40960,'application/pdf',
         'compliant','approved',$3,false,'site',$9,NULL,false)
    `, [CO1, CO2, CO3, U_CON1, U_CON2, S1A, S1B, S2A, S2B, S3A, S3B, future, overdue]);

    // ── 8. INCIDENTS ──────────────────────────────────────────────────────────
    console.log("🚨  Seeding incidents…");

    await client.query(`
      INSERT INTO incidents (id, incident_reference, site_id, entity_id, title, description,
        incident_type, severity, status, incident_date, injuries_reported, riddor_reportable,
        reported_by, reported_by_name, assigned_consultant, is_archived)
      VALUES
        (gen_random_uuid(),'INC-STAG-001',$1,$4,'Slips on wet floor in warehouse','Employee slipped near loading bay after rain ingress.',
         'slip_trip_fall','minor','reported',$7,false,false,$2,'James Wright',$2,false),
        (gen_random_uuid(),'INC-STAG-002',$1,$4,'Near miss with forklift','Forklift truck came within 1m of pedestrian in unmarked zone.',
         'near_miss','moderate','under_investigation',$8,false,false,$2,'James Wright',$2,false),
        (gen_random_uuid(),'INC-STAG-003',$2,$5,'Chemical spill in warehouse','Small quantity of cleaning agent spilled; area cordoned and cleaned.',
         'environmental','moderate','resolved',$9,false,false,$3,'Sarah Hayes',$3,false),
        (gen_random_uuid(),'INC-STAG-004',$3,$4,'Manual handling back strain','Employee reported lower back pain after unloading delivery.',
         'injury','minor','reported',$10,true,false,$5,'David Hartwell',NULL,false)
    `, [S1A, U_CON1, U_CON2, CO1, CO2, CO3, past, now, future,
        U_CLI1A, U_CLI1B, U_CLI2A]);

    // ── 9. CASES ──────────────────────────────────────────────────────────────
    console.log("⚖️   Seeding cases…");

    await client.query(`
      INSERT INTO cases (id, entity_id, site_id, case_reference, case_number, case_name,
        employee_name, case_type, status, description, is_confidential, is_archived,
        assigned_consultant, created_by)
      VALUES
        (gen_random_uuid(),$1,$5,'CSE-STAG-001','EL-2025-001','Tribunal Claim — T. Bradley',
         'Thomas Bradley','tribunal_claim','open',
         'Former employee claim of unfair dismissal following redundancy process.',true,false,$3,$4),
        (gen_random_uuid(),$2,$7,'CSE-STAG-002','EL-2025-002','ACAS Conciliation — R. Patel',
         'Ravi Patel','acas_conciliation','open',
         'Discrimination allegation under ACAS early conciliation.',true,false,$4,$3),
        (gen_random_uuid(),$1,$5,'CSE-STAG-003','EL-2025-003','Grievance — K. Singh',
         'Kavita Singh','grievance','closed',
         'Internal grievance regarding workplace conduct. Resolved via mediation.',true,false,$3,$4)
    `, [CO1, CO2, CO3, U_CON1, U_CON2, S1A, S1B, S2A, S2B]);

    // ── 10. TRAINING ──────────────────────────────────────────────────────────
    console.log("🎓  Seeding training…");

    const TF1 = "seed-tf-health-safety";
    const TF2 = "seed-tf-employment";

    await client.query(`
      INSERT INTO training_folders (id, title, module, description, display_order)
      VALUES
        ($1,'Health & Safety Courses','health_safety','Core H&S training for all staff',1),
        ($2,'Employment Law Courses','employment_law','Employment legislation and HR best practice',2)
      ON CONFLICT (id) DO NOTHING
    `, [TF1, TF2]);

    const TC1 = "seed-tc-fire-marshal";
    const TC2 = "seed-tc-manual-handling";
    const TC3 = "seed-tc-employment-law";

    await client.query(`
      INSERT INTO training_courses (id, title, folder_id, module, description,
        duration_hours, training_method, max_delegates, is_mandatory, is_active, display_order)
      VALUES
        ($1,'Fire Marshal Training',$4,'health_safety','Comprehensive fire marshal certification including evacuation procedures.',
         4,'in_person',12,true,true,1),
        ($2,'Manual Handling Awareness',$4,'health_safety','Safe manual handling techniques and risk reduction.',
         2,'online',NULL,true,true,2),
        ($3,'Employment Law Fundamentals',$5,'employment_law','Key employment legislation: contracts, discrimination, disciplinary procedures.',
         6,'in_person',20,false,true,1)
      ON CONFLICT (id) DO NOTHING
    `, [TC1, TC2, TC3, TF1, TF2]);

    const bookingDates = [
      new Date(now.getTime() + 14 * 86400000),
      new Date(now.getTime() + 30 * 86400000),
      new Date(now.getTime() - 7 * 86400000),
    ];

    await client.query(`
      INSERT INTO training_bookings (id, training_course_id, site_id, entity_id,
        booked_by, scheduled_date, delegate_count, status, notes)
      VALUES
        (gen_random_uuid(),$1,$4,$7,$9,$10,8,'confirmed','Annual refresher for site team'),
        (gen_random_uuid(),$2,$5,$7,$9,$11,15,'confirmed','All new starters to complete online'),
        (gen_random_uuid(),$3,$6,$8,$9,$12,6,'completed','Completed with good feedback')
    `, [TC1, TC2, TC3, S1A, S2A, S2B, CO1, CO2, U_CON1, ...bookingDates]);

    // ── 11. SUPPORT REQUESTS ─────────────────────────────────────────────────
    console.log("🎧  Seeding support requests…");

    await client.query(`
      INSERT INTO support_requests (id, subject, description, priority, status, category,
        module, site_id, created_by, assigned_to)
      VALUES
        (gen_random_uuid(),'Unable to upload document — file size error',
         'When trying to upload the updated fire risk assessment I receive an error about file size limits.',
         'high','open','technical','health_safety',$1,$5,$7),
        (gen_random_uuid(),'Document approval workflow question',
         'Can you explain the steps for the client sign-off process? I am unsure what happens after I upload.',
         'medium','in_progress','guidance','health_safety',$2,$6,$7),
        (gen_random_uuid(),'Incident report not showing on dashboard',
         'I submitted an incident report last week but it does not appear on the incidents list.',
         'medium','resolved','technical','health_safety',$3,$8,$8)
    `, [S1A, S1B, S2A, CO1, CO2, U_CLI1A, U_CLI2A, U_CON1, U_CON2]);

    console.log("\n✅  Staging seed complete!\n");
    console.log("─────────────────────────────────────────────");
    console.log("Login credentials (all use: Staging123!)");
    console.log("─────────────────────────────────────────────");
    console.log("Admin        admin@staging.guardian.com");
    console.log("Consultant   james.wright@guardian.com      (Pro)");
    console.log("Consultant   sarah.hayes@guardian.com       (Standard)");
    console.log("Client       david.hartwell@hartwell.co.uk  (Hartwell Construction)");
    console.log("Client       phil.stone@hartwell.co.uk      (Hartwell Construction)");
    console.log("Client       claire.medway@meridianlog.co.uk (Meridian Logistics)");
    console.log("Client       mark.lowe@meridianlog.co.uk    (Meridian Logistics)");
    console.log("Client       tom.apex@apexretail.co.uk      (Apex Retail Group)");
    console.log("Client       lucy.west@apexretail.co.uk     (Apex Retail Group)");
    console.log("─────────────────────────────────────────────\n");

  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
