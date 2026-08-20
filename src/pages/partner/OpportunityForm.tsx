import { useParams } from "react-router-dom";
import { OpportunityForm } from "@/components/opportunities/OpportunityForm";

const PartnerOpportunityForm = () => {
  const { id } = useParams<{ id: string }>();
  const opportunityId = id ? parseInt(id, 10) : undefined;

  return <OpportunityForm role="partner" opportunityId={opportunityId} />;
};

export default PartnerOpportunityForm;
