-- Add 'tentative' (ไม่แน่นอน) status to reg_status enum
alter type reg_status add value 'tentative' after 'waitlisted';
