#!/usr/bin/env ruby
require 'json'; require 'base64'; require 'open3'
REPO = "Xinji-Mai/Xinji-Mai.github.io"; BRANCH = "master"; ROOT = File.expand_path(File.dirname(__FILE__))
def sh(*c); o,s=Open3.capture2(*c); raise "FAIL #{c.join(' ')}\n#{o}" unless s.success?; o; end
def gh(m,p,b=nil)
  4.times do |i|
    a=["gh","api","-X",m,p]; a+=["--input","-"] if b
    o,e,s=Open3.capture3(*a,stdin_data:(b ? b.to_json : ""))
    return (o.strip.empty? ? nil : JSON.parse(o)) if s.success?
    raise "gh #{m} #{p} FAIL\n#{e}\n#{o}" if i==3
    sleep 4
  end
end
head = gh("GET","repos/#{REPO}/git/ref/heads/#{BRANCH}"); hs=head["object"]["sha"]
commit = gh("GET","repos/#{REPO}/git/commits/#{hs}")
remote = gh("GET","repos/#{REPO}/git/trees/#{commit['tree']['sha']}?recursive=1")
present={}; remote["tree"].each{|e| present[e["sha"]]=true if e["type"]=="blob"}
puts "head=#{hs[0,7]} blobs=#{present.size}"
entries=[]; reused=0; inlined=0; uploaded=0
sh("git","-C",ROOT,"ls-tree","-r","main").each_line do |line|
  meta,path=line.chomp.split("\t",2); mode,type,sha=meta.split(" "); next unless type=="blob"
  if present[sha]; entries<<{"path"=>path,"mode"=>mode,"type"=>"blob","sha"=>sha}; reused+=1
  else
    data=File.binread(File.join(ROOT,path)); txt=data.dup.force_encoding("UTF-8").valid_encoding? && !data.include?("\x00")
    if txt; entries<<{"path"=>path,"mode"=>mode,"type"=>"blob","content"=>data.force_encoding("UTF-8")}; inlined+=1
    else b=gh("POST","repos/#{REPO}/git/blobs",{"content"=>Base64.strict_encode64(data),"encoding"=>"base64"}); entries<<{"path"=>path,"mode"=>mode,"type"=>"blob","sha"=>b["sha"]}; uploaded+=1; end
  end
end
puts "entries=#{entries.size} reused=#{reused} inlined=#{inlined} uploaded=#{uploaded}"
tree=gh("POST","repos/#{REPO}/git/trees",{"tree"=>entries})
nc=gh("POST","repos/#{REPO}/git/commits",{"message"=>"Terramai: seek display shortening + refreshed intro text","tree"=>tree["sha"],"parents"=>[hs]})
gh("PATCH","repos/#{REPO}/git/refs/heads/#{BRANCH}",{"sha"=>nc["sha"],"force"=>false})
puts "DONE #{nc['sha']}"
