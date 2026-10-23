"""Smoke test for the question recommender hosted on Hugging Face.

Usage:
    pip install sentence-transformers pandas numpy huggingface_hub
    python test_hf_model.py --repo your-username/question-recommender
    python test_hf_model.py --repo your-username/question-recommender --company nCircle --role "Backend Developer" --n 5

Needs recommender.py in the same folder. For a private repo: huggingface-cli login (or set HF_TOKEN).
"""
import argparse

from huggingface_hub import snapshot_download

from recommender import Recommender, Session

p = argparse.ArgumentParser()
p.add_argument("--repo", required=True, help="HF repo id, e.g. user/question-recommender")
p.add_argument("--company", default="nCircle")
p.add_argument("--role", default="Backend Developer")
p.add_argument("--round", default="L1 Technical Interview")
p.add_argument("--n", type=int, default=5, help="questions to ask")
args = p.parse_args()

path = snapshot_download(args.repo)
rec = Recommender(path)
print(f"Loaded: {len(rec.df)} questions, {len(set(rec.cluster))} unique clusters\n")

# 1) Ask questions from a session
s = Session(rec, args.company, args.role, args.round, seed=0)
asked = []
for i in range(args.n):
    q = s.next()
    if q is None:
        print("Question bank exhausted.")
        break
    asked.append(q)
    print(f"{i + 1}. [{q['topic']}] {q['question']}  (score {q['score']:.3f})")

# 2) No-repeat check: drain a full session
full = Session(rec, args.company, args.role, args.round, seed=1)
all_q = []
while (q := full.next()) is not None:
    all_q.append(q["question"])
assert len(all_q) == len(set(all_q)), "FAIL: repeated question in a session"
assert len(all_q) == len(set(rec.cluster)), "FAIL: session did not cover all clusters"
print(f"\nPASS: no repeats across {len(all_q)} questions")

# 3) Unseen company still works
new = Session(rec, "SomeNewCompany", args.role).next()
assert new is not None
print("PASS: unseen company returns a question")