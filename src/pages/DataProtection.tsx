import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DataProtection = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/privacy", { replace: true });
  }, [navigate]);

  return null;
};

export default DataProtection;
