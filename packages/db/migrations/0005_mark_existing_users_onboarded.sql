-- Onboarding (/getting-started) arrived after these accounts were made; only new sign-ups go through it.
UPDATE `users` SET `completedOnboarding` = 1;
