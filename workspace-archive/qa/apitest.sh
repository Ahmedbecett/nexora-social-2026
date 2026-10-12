B=http://127.0.0.1:3001/api
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
TA=$(curl -s $B/auth/login -H 'Content-Type: application/json' -d '{"identifier":"qa.temp.chat","password":"<QA_TEMP_PASSWORD>"}' | j "d.get('token') or d")
TB=$(curl -s $B/auth/login -H 'Content-Type: application/json' -d '{"identifier":"official.nexora","password":"<OFFICIAL_PASSWORD>"}' | j "d.get('token') or d")
IA=29; IB=12
echo "A=$IA tokens ${TA:0:10} ${TB:0:10}"
M1=$(curl -s -X POST $B/messages/$IB -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{"text":"QA test 1"}' | j "d['message']['id']")
M2=$(curl -s -X POST $B/messages/$IA -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d "{\"text\":\"QA reply\",\"replyTo\":$M1}" | j "(d['message']['id'], d['message']['reply'])")
echo "M1=$M1 M2=$M2"
S=$(curl -s "$B/messages/$IA?after=0" -H "Authorization: Bearer $TB" | j "d['serverTime']")
curl -s -X POST $B/message/$M1/react -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"emoji":"❤️"}'; echo
curl -s -X POST $B/message/$M1/react -H "Authorization: Bearer $TB" -H 'Content-Type: application/json' -d '{"emoji":"abc"}'; echo
curl -s -X POST $B/message/$M1/pin -H "Authorization: Bearer $TA"; echo
sleep 1
curl -s "$B/messages/$IB?after=999999999&since=$S" -H "Authorization: Bearer $TA" | j "[(m['id'],m.get('reactions'),m.get('pinned'),m.get('gone')) for m in d['messages']]"
curl -s -X DELETE $B/message/$M1 -H "Authorization: Bearer $TB"; echo "  <- B unsend A's msg should be forbidden"
curl -s -X DELETE $B/message/$M1 -H "Authorization: Bearer $TA"; echo
curl -s "$B/messages/$IA?after=999999999&since=$S" -H "Authorization: Bearer $TB" | j "[(m['id'],m.get('gone'),m.get('reply')) for m in d['messages']]"
curl -s -X POST $B/message/$M1/hide -H "Authorization: Bearer $TA"; echo "  <- hide unsent: 404 expected"
MID=$(echo "$M2" | tr -d "()," | awk "{print \$1}")
curl -s -X POST $B/message/$MID/hide -H "Authorization: Bearer $TA"; echo
curl -s "$B/messages/$IB?after=0" -H "Authorization: Bearer $TA" | j "[m['id'] for m in d['messages']][-4:]"
curl -s "$B/messages/$IA?after=0" -H "Authorization: Bearer $TB" | j "[(m['id'],m['text'],m.get('reply')) for m in d['messages']][-3:]"
curl -s $B/conversations -H "Authorization: Bearer $TA" | j "[(c['user']['username'],c['last']['text']) for c in d['conversations']]"
echo "$M1 $MID" > /tmp/qa_ids
