import { useSearchParams } from "react-router-dom";
import ProductForm from "../Components/admin/ProductForm";

// /products/add?copy=12 opens the form filled in from product 12 ("Duplicate")
function AddProduct() {
  const [params] = useSearchParams();
  const copy = Number(params.get("copy"));
  return <ProductForm copyFromId={Number.isInteger(copy) && copy > 0 ? copy : undefined} />;
}

export default AddProduct;
