drop extension if exists "pg_net";

drop trigger if exists "update_applications_updated_at" on "public"."applications";

drop policy "Users can delete their own documents" on "storage"."objects";

drop policy "Users can upload their own documents" on "storage"."objects";

drop policy "Users can view their own documents" on "storage"."objects";


