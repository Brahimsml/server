import { useParams } from "react-router-dom";
import PlaceForm from "../Components/admin/PlaceForm";

const UpdatePlace = () => {
  const { id } = useParams();
  return <PlaceForm placeId={id} />;
};

export default UpdatePlace;
