-- Enforce file types and sizes at the storage layer (not just in the app's forms).
update storage.buckets set file_size_limit = 4194304, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'] where id = 'verification-docs';
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] where id = 'resumes';
update storage.buckets set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'] where id = 'post-media';
update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id in ('avatars', 'company-logos');
