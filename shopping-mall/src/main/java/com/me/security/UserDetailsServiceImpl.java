package com.me.security;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.me.user.entity.Authority;
import com.me.user.entity.User;
import com.me.user.mapper.AuthorityMapper;
import com.me.user.mapper.UserMapper;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserMapper userMapper;
    private final AuthorityMapper authorityMapper;

    public UserDetailsServiceImpl(
            UserMapper userMapper,
            AuthorityMapper authorityMapper) {

        this.userMapper = userMapper;
        this.authorityMapper = authorityMapper;
    }

    @Override
    public UserDetails loadUserByUsername(String username)
            throws UsernameNotFoundException {

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username)
        );

        if (user == null) {
            throw new UsernameNotFoundException("User not found");
        }

        Authority authority = authorityMapper.selectOne(
                new LambdaQueryWrapper<Authority>().eq(Authority::getUsername, username)
        );

        return new LoginUser(user, authority);
    }
}