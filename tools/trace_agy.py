import json,glob,re,collections,datetime,sys
B='/Users/hoangnguyen142/.gemini/antigravity/brain/'
ids={'da11aac4':'script','e8b8b2e7':'design','3c8b896a':'shots','eed7e8ad':'rev1','74cb4fb4':'rev2','20dc6f2a':'rev3','cbc8869f':'ver','013e4d62':'audio','59dab676':'deliver'}
def T(s): return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def cat(tc):
    n=tc['name'];a=str(tc['args'])
    if n=='read_file':
        if re.search(r'\.(jpg|png)',a): return 'look_img'
        if 'story-video-skills' in a or 'SKILL' in a: return 'read_skill'
        return 'read_file'
    if n in('edit_file','write_file','replace_file_content','multi_replace_file_content'):
        return 'write_review' if 'qa/review' in a or 'review.md' in a else 'edit'
    if n=='run_command':
        for k,v in [('voice.py','voice'),('mix.py','mix'),('deliver.mjs','render_final'),('design.mjs','render_design'),('qa.mjs','render_qa'),('lint.mjs','lint'),('tsc','tsc'),('sv_gate.py','gate'),('times.mjs','times')]:
            if k in a: return v
        return 'shell'
    if n in('read_board','swarm_wait','post_message','swarm','manage_task','schedule'): return 'coord'
    return n
out={}
for k,name in ids.items():
    L=[json.loads(l) for l in open(glob.glob(B+k+'*/.system_generated/logs/transcript.jsonl')[0])]
    P=[d for d in L if d['type']=='PLANNER_RESPONSE']
    agg=collections.defaultdict(lambda:[0,0.0,0])  # calls, wall s, tokens
    for i,d in enumerate(P):
        nxt=T(P[i+1]['created_at']) if i+1<len(P) else T(L[-1]['created_at'])
        wall=min(nxt-T(d['created_at']),1800)
        tok=d.get('input_tokens',0)+d.get('cache_read_tokens',0)+d.get('output_tokens',0)
        cs=[cat(t) for t in d.get('tool_calls',[])] or ['think']
        for c in cs:
            agg[c][0]+=1; agg[c][1]+=wall/len(cs); agg[c][2]+=tok/len(cs)
    out[name]=agg
    tw=sum(v[1] for v in agg.values());tt=sum(v[2] for v in agg.values())
    print(f'\n== {name}: wall {tw/60:.0f} min, tok {tt/1e6:.1f}M')
    for c,(n,w,t) in sorted(agg.items(),key=lambda x:-x[1][2]):
        print(f'  {c:14s} calls {n:4d}  wall {w/60:6.1f} min  tok {t/1e6:5.2f}M')
tot=collections.defaultdict(lambda:[0,0,0])
for a in out.values():
    for c,v in a.items():
        for j in range(3): tot[c][j]+=v[j]
print('\n== ALL')
for c,(n,w,t) in sorted(tot.items(),key=lambda x:-x[1][2]): print(f'  {c:14s} calls {n:4d}  wall {w/60:6.1f} min  tok {t/1e6:5.2f}M')
