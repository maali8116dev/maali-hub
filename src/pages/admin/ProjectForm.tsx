import { useParams } from "react-router-dom";
import { OpportunityForm } from "@/components/opportunities/OpportunityForm";

const ProjectForm = () => {
  const { id } = useParams<{ id: string }>();
  const opportunityId = id ? parseInt(id, 10) : undefined;

  return <OpportunityForm role="admin" opportunityId={opportunityId} />;
};

export default ProjectForm;
