   SELECT proname, prosecdef, proconfig 
  FROM pg_proc 
  WHERE proname = 'get_user_role';