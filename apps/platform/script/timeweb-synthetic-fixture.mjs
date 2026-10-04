import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha='a'.repeat(64);
const outlet={guidStore:id(10),closed:false,holdingName:'Синтетическая ТТ',
  address:{storeAddress:'Тестовый адрес'},managers:{manager:{guid:id(20),name:'Тестовый менеджер'}},
  provenance:{sourceSha256:sha,freshness:'current'}};
const d={capturedAt:new Date().toISOString(),origin:'synthetic',
  clients:[{guid_client:id(1),name_client:'Синтетический клиент',baseline_status:'active',
    guid_manager:id(20),name_manager:'Тестовый менеджер',source_sha256:sha,
    manager_roster_state:'outside_wholesale_roster',extended_snapshot:{currentRetailOutlets:[outlet]}}],
  outlets:[{guid_store:id(10),guid_client:id(1),is_closed:false,last_source_sha256:sha}],
  admins:[{id:id(90),email:'migration-admin@example.test',full_name:'Тестовый администратор',
    role:'admin',status:'active',password_hash:await bcrypt.hash('Synthetic-test-only-2026!',10)}],
  sections:[{code:id(30),name:'Двери'}],groups:[{code:id(31)}],
  products:[{code:id(40),name:'Тестовая дверь',group_code:id(31),activity:true}],
  product_properties:[{product_code:id(40),property_code:id(50),property_name:'Цвет',property_value:'Белый'}],
  product_images:[],product_sections:[{product_code:id(40),section_code:id(30)}],
  catalogVersion:{import_profile:'distribution'}};
const raw=JSON.stringify(d);
fs.writeFileSync(process.argv[2],raw,{mode:0o600});
console.log(crypto.createHash('sha256').update(raw).digest('hex'));
