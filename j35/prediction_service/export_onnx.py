import os
import numpy as np
import torch
import onnx
import onnxruntime as ort
from model import SkillPredictor, FEATURE_DIM, SEQUENCE_LENGTH

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
PT_PATH = os.path.join(MODEL_DIR, "skill_predictor.pt")
ONNX_PATH = os.path.join(MODEL_DIR, "skill_predictor.onnx")

OPSET_VERSION = 17


def export_onnx():
    checkpoint = torch.load(PT_PATH, map_location="cpu")
    model = SkillPredictor()
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    dummy_input = torch.randn(1, SEQUENCE_LENGTH, FEATURE_DIM)

    torch.onnx.export(
        model,
        dummy_input,
        ONNX_PATH,
        opset_version=OPSET_VERSION,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        },
    )

    print(f"ONNX model exported to {ONNX_PATH}")

    onnx_model = onnx.load(ONNX_PATH)
    onnx.checker.check_model(onnx_model)
    print("ONNX model validation passed")

    verify_onnx(model, dummy_input)


def verify_onnx(pytorch_model, dummy_input):
    pytorch_model.eval()
    with torch.no_grad():
        pt_output = pytorch_model(dummy_input).numpy()

    session = ort.InferenceSession(ONNX_PATH)
    ort_output = session.run(
        None,
        {"input": dummy_input.numpy()}
    )[0]

    max_diff = np.max(np.abs(pt_output - ort_output))
    print(f"Max absolute difference between PyTorch and ONNX: {max_diff:.8f}")

    if max_diff < 1e-5:
        print("ONNX export verified: outputs match PyTorch within tolerance")
    else:
        print("WARNING: ONNX output differs from PyTorch output!")


if __name__ == "__main__":
    export_onnx()
