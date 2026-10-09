
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn
from torch_geometric.nn import SAGEConv


ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class GraphSAGE(nn.Module):
    def __init__(self, in_channels, hidden_channels=32, dropout=0.2):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, hidden_channels)
        self.classifier = nn.Linear(hidden_channels, 2)
        self.dropout = dropout

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)
        return self.classifier(x)


def load_graphsage():
    checkpoint_path = ARTIFACT_DIR / "graphsage_checkpoint.pt"
    features_path = ARTIFACT_DIR / "graphsage_train_features.npy"
    edges_path = ARTIFACT_DIR / "graphsage_train_edge_index.npy"

    checkpoint = torch.load(
        checkpoint_path,
        map_location=DEVICE,
        weights_only=True,
    )

    train_features = np.load(features_path).astype(np.float32)
    train_edges = np.load(edges_path).astype(np.int64)

    model = GraphSAGE(
        in_channels=checkpoint["in_channels"],
        hidden_channels=checkpoint["hidden_channels"],
        dropout=checkpoint["dropout"],
    ).to(DEVICE)

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    return model, train_features, train_edges


def predict_graphsage(transformed_features):
    """
    transformed_features: one patient's preprocessed 21-feature vector.
    Returns the predicted class and class-1 probability.
    """
    model, train_features, train_edges = load_graphsage()

    patient = np.asarray(transformed_features, dtype=np.float32).reshape(1, -1)

    if patient.shape[1] != train_features.shape[1]:
        raise ValueError(
            f"Expected {train_features.shape[1]} features, "
            f"received {patient.shape[1]}."
        )

    # Build a graph containing the training reference nodes and one new patient.
    x = np.vstack([train_features, patient])
    patient_idx = len(train_features)

    # Connect the patient to the five most similar training nodes using cosine distance.
    train_norms = np.linalg.norm(train_features, axis=1)
    patient_norm = np.linalg.norm(patient[0])

    denom = train_norms * patient_norm
    similarities = np.divide(
        train_features @ patient[0],
        denom,
        out=np.zeros_like(train_norms),
        where=denom > 0,
    )

    k = min(5, len(train_features))
    neighbors = np.argsort(similarities)[-k:]

    patient_edges = np.array(
        [
            np.concatenate([neighbors, np.full(k, patient_idx)]),
            np.concatenate([np.full(k, patient_idx), neighbors]),
        ],
        dtype=np.int64,
    )

    edges = np.concatenate([train_edges, patient_edges], axis=1)

    x_tensor = torch.tensor(x, dtype=torch.float32, device=DEVICE)
    edge_tensor = torch.tensor(edges, dtype=torch.long, device=DEVICE)

    with torch.no_grad():
        logits = model(x_tensor, edge_tensor)
        probabilities = torch.softmax(logits[patient_idx], dim=0)

    predicted_class = int(probabilities.argmax().item())
    positive_probability = float(probabilities[1].item())

    return {
        "predicted_class": predicted_class,
        "estimated_probability": positive_probability,
        "model": "GraphSAGE",
    }
