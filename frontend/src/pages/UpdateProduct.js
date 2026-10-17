import { useParams } from "react-router-dom";
import ProductForm from "../Components/admin/ProductForm";

function UpdateProduct() {
  const { id } = useParams();
  return <ProductForm productId={id} />;
}

export default UpdateProduct;
