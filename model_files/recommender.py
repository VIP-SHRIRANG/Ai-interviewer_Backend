import json
from pathlib import Path
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer


def make_query(company, role, rnd=""):
    q = f"company: {company} | role: {role}"
    return q + (f" | round: {rnd}" if rnd else "")


def make_doc(topic, question):
    return f"{topic}. {question}" if topic else question


class Recommender:
    def __init__(self, art_dir="artifacts"):
        art = Path(art_dir)
        self.model = SentenceTransformer(str(art / "model"))
        self.emb = np.load(art / "corpus_emb.npy")
        self.df = pd.read_csv(art / "corpus.csv").fillna("")
        self.cluster = self.df["cluster"].to_numpy()
        self.company_lc = self.df["company"].str.lower().to_numpy()
        self.topic_id, uniques = pd.factorize(self.df["topic"])
        self.n_topics = len(uniques)
        self.companies = sorted(self.df["company"].unique())

    def encode_query(self, company, role, rnd=""):
        return self.model.encode(make_query(company, role, rnd), normalize_embeddings=True)


class Session:
    """One interview session. Never returns the same question (or a near-duplicate) twice."""

    def __init__(self, rec, company, role, rnd="", company_boost=0.15,
                 topic_penalty=0.05, top_k=3, temperature=0.05, seed=None):
        self.rec, self.top_k, self.temperature = rec, top_k, temperature
        self.topic_penalty = topic_penalty
        self.rng = np.random.default_rng(seed)
        q = rec.encode_query(company, role, rnd)
        self.base = rec.emb @ q
        # soft preference for the requested company (new/unknown companies get no boost)
        self.base = self.base + company_boost * (rec.company_lc == company.lower())
        self.asked = set()
        self.topic_counts = np.zeros(rec.n_topics)
        self.history = []

    def next(self):
        r = self.rec
        scores = self.base - self.topic_penalty * self.topic_counts[r.topic_id]
        if self.asked:
            scores = np.where(np.isin(r.cluster, list(self.asked)), -np.inf, scores)
        if not np.isfinite(scores).any():
            return None  # question bank exhausted
        idx = np.argsort(-scores)[: self.top_k]
        idx = idx[np.isfinite(scores[idx])]
        if len(idx) > 1 and self.temperature > 0:
            z = (scores[idx] - scores[idx].max()) / self.temperature
            p = np.exp(z) / np.exp(z).sum()
            i = int(self.rng.choice(idx, p=p))
        else:
            i = int(idx[0])
        self.asked.add(int(r.cluster[i]))
        self.topic_counts[r.topic_id[i]] += 1
        row = r.df.iloc[i]
        out = {"question": row["question"], "topic": row["topic"], "round": row["round"],
               "company": row["company"], "url": row["url"], "score": float(scores[i])}
        self.history.append(out)
        return out
